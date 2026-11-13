import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  getMayAprilBusinessYear,
  getMayAprilBusinessYearRange,
  getMayAprilBusinessYearOptions,
} from "@/lib/academicYear";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedBY =
      searchParams.get("businessYear") || getMayAprilBusinessYear(new Date());

    const targetRange = getMayAprilBusinessYearRange(requestedBY);
    const targetStartYear = parseInt(requestedBY.split("-")[0], 10);

    // Fetch user with shop info
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        shopName: true,
        phone: true,
        gstNo: true,
        village: true,
        mandal: true,
        district: true,
        state: true,
      },
    });

    // Fetch all products
    const products = await prisma.product.findMany({
      where: { userId: session.user.id },
      orderBy: { name: "asc" },
    });

    // Fetch all stock movements up to the end of target business year
    const stockMovements = await prisma.stockMovement.findMany({
      where: {
        userId: session.user.id,
        date: { lte: targetRange.endDate },
      },
      orderBy: { date: "asc" },
    });

    // Fetch all bills for this user's farmers up to the end of target business year
    const bills = await prisma.bill.findMany({
      where: {
        farmer: { userId: session.user.id },
        date: { lte: targetRange.endDate },
      },
      orderBy: { date: "asc" },
    });

    // Determine earliest relevant year
    const allDates: number[] = [];
    products.forEach((p) => allDates.push(new Date(p.createdAt).getTime()));
    stockMovements.forEach((m) => allDates.push(new Date(m.date).getTime()));
    bills.forEach((b) => allDates.push(new Date(b.date).getTime()));

    let earliestBY = requestedBY;
    if (allDates.length > 0) {
      const minDate = new Date(Math.min(...allDates));
      earliestBY = getMayAprilBusinessYear(minDate);
    }
    const earliestStartYear = Math.min(
      parseInt(earliestBY.split("-")[0], 10),
      targetStartYear
    );

    // Build unique product catalog map: key = `${category}__${name.toLowerCase()}`
    // to track multi-year carry forward consistently even across slight naming variations
    interface ProductTracker {
      id?: string;
      category: "FERTILIZER" | "PESTICIDE" | string;
      name: string;
      size: string | null;
      price: number;
      createdAt: Date;
    }

    const catalogMap = new Map<string, ProductTracker>();

    products.forEach((p) => {
      const key = `${p.category}__${p.name.trim().toLowerCase()}`;
      if (!catalogMap.has(key)) {
        catalogMap.set(key, {
          id: p.id,
          category: p.category,
          name: p.name.trim(),
          size: p.size,
          price: p.price,
          createdAt: p.createdAt,
        });
      }
    });

    // Also include products from stock movements or bills that might not have a current Product row
    stockMovements.forEach((m) => {
      const key = `${m.category}__${m.productName.trim().toLowerCase()}`;
      if (!catalogMap.has(key)) {
        catalogMap.set(key, {
          id: m.productId || undefined,
          category: m.category,
          name: m.productName.trim(),
          size: m.size,
          price: m.price || 0,
          createdAt: m.date,
        });
      }
    });

    bills.forEach((b) => {
      // Bill product may be "Name" or "Name (Size)"
      const rawName = b.product.trim();
      const match = rawName.match(/^(.*?)(?:\s*\((.*?)\))?$/);
      const baseName = match && match[1] ? match[1].trim() : rawName;
      const key = `${b.category}__${baseName.toLowerCase()}`;
      if (!catalogMap.has(key)) {
        catalogMap.set(key, {
          category: b.category,
          name: baseName,
          size: match && match[2] ? match[2].trim() : null,
          price: b.price || 0,
          createdAt: b.date,
        });
      }
    });

    // Multi-Year Simulation from earliestStartYear to targetStartYear
    // carryForwardMap: key -> closingStock of previous year
    const carryForwardMap = new Map<string, number>();

    interface YearProductResult {
      id?: string;
      category: string;
      name: string;
      size: string | null;
      price: number;
      openingStock: number;
      receivedStock: number;
      soldStock: number;
      closingStock: number;
      totalValue: number;
    }

    let targetYearResults: YearProductResult[] = [];

    for (let yr = earliestStartYear; yr <= targetStartYear; yr++) {
      const curBY = `${yr}-${String(yr + 1).slice(2)}`;
      const curRange = getMayAprilBusinessYearRange(curBY);
      const isTargetYear = yr === targetStartYear;

      const currentYearResults: YearProductResult[] = [];

      catalogMap.forEach((prod, key) => {
        // 1. Opening stock = carried forward closing stock from previous year
        const openingStock = carryForwardMap.get(key) || 0;

        // 2. Received stock in this business year
        const movementsInYear = stockMovements.filter((m) => {
          const mKey = `${m.category}__${m.productName.trim().toLowerCase()}`;
          const mTime = new Date(m.date).getTime();
          return (
            mKey === key &&
            mTime >= curRange.startDate.getTime() &&
            mTime <= curRange.endDate.getTime()
          );
        });

        let receivedStock = 0;
        let explicitOpeningInYear = 0;

        movementsInYear.forEach((m) => {
          if (m.movementType === "OPENING_BALANCE") {
            explicitOpeningInYear += m.quantity;
          } else {
            receivedStock += m.quantity;
          }
        });

        // Fallback for legacy products created in this business year without explicit movements
        if (movementsInYear.length === 0 && yr === earliestStartYear) {
          const matchingProduct = products.find(
            (p) => `${p.category}__${p.name.trim().toLowerCase()}` === key
          );
          if (matchingProduct) {
            // Check total bills sold in all years to reconstruct initial received
            const totalEverSold = bills
              .filter((b) => {
                const bKey = `${b.category}__${b.product.trim().toLowerCase()}`;
                return bKey.startsWith(key);
              })
              .reduce((sum, b) => sum + b.quantity, 0);
            receivedStock = Math.max(0, matchingProduct.quantity + totalEverSold);
          }
        }

        const effectiveOpening =
          openingStock > 0 ? openingStock : explicitOpeningInYear;

        // 3. Sold stock in this business year from Bills
        const billsInYear = bills.filter((b) => {
          const bRawName = b.product.trim().toLowerCase();
          const pNameLower = prod.name.toLowerCase();
          const matchesProduct =
            b.category === prod.category &&
            (bRawName === pNameLower ||
              bRawName.startsWith(`${pNameLower} (`) ||
              bRawName.startsWith(pNameLower));
          const bTime = new Date(b.date).getTime();
          return (
            matchesProduct &&
            bTime >= curRange.startDate.getTime() &&
            bTime <= curRange.endDate.getTime()
          );
        });

        const soldStock = billsInYear.reduce((sum, b) => sum + b.quantity, 0);

        // 4. Closing stock = Opening + Received - Sold
        const closingStock = Math.max(0, effectiveOpening + receivedStock - soldStock);

        // Store closing stock as carry-forward for the next year
        carryForwardMap.set(key, closingStock);

        if (isTargetYear) {
          const totalValue = closingStock * (prod.price || 0);
          currentYearResults.push({
            id: prod.id,
            category: prod.category,
            name: prod.name,
            size: prod.size,
            price: prod.price,
            openingStock: effectiveOpening,
            receivedStock,
            soldStock,
            closingStock,
            totalValue,
          });
        }
      });

      if (isTargetYear) {
        targetYearResults = currentYearResults;
      }
    }

    // Separate independently into Fertilizers and Pesticides, sorted A–Z by name
    const fertilizers = targetYearResults
      .filter((r) => r.category === "FERTILIZER")
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

    const pesticides = targetYearResults
      .filter((r) => r.category === "PESTICIDE")
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

    // Compute Summaries
    const computeSummary = (items: YearProductResult[]) => ({
      totalItems: items.length,
      totalOpening: items.reduce((s, i) => s + i.openingStock, 0),
      totalReceived: items.reduce((s, i) => s + i.receivedStock, 0),
      totalSold: items.reduce((s, i) => s + i.soldStock, 0),
      totalClosing: items.reduce((s, i) => s + i.closingStock, 0),
      totalValuation: items.reduce((s, i) => s + i.totalValue, 0),
    });

    const fertilizersSummary = computeSummary(fertilizers);
    const pesticidesSummary = computeSummary(pesticides);

    const grandSummary = {
      totalItems: fertilizersSummary.totalItems + pesticidesSummary.totalItems,
      totalOpening: fertilizersSummary.totalOpening + pesticidesSummary.totalOpening,
      totalReceived: fertilizersSummary.totalReceived + pesticidesSummary.totalReceived,
      totalSold: fertilizersSummary.totalSold + pesticidesSummary.totalSold,
      totalClosing: fertilizersSummary.totalClosing + pesticidesSummary.totalClosing,
      totalValuation: fertilizersSummary.totalValuation + pesticidesSummary.totalValuation,
    };

    // Available business years list for the dropdown
    const availableYears = getMayAprilBusinessYearOptions();
    if (!availableYears.includes(requestedBY)) {
      availableYears.push(requestedBY);
      availableYears.sort().reverse();
    }

    return NextResponse.json({
      shopInfo: user,
      businessYear: requestedBY,
      dateRange: {
        startDate: targetRange.startDate.toISOString(),
        endDate: targetRange.endDate.toISOString(),
      },
      fertilizers,
      pesticides,
      fertilizersSummary,
      pesticidesSummary,
      grandSummary,
      availableYears,
    });
  } catch (error: any) {
    console.error("Error generating annual stock report:", error);
    return NextResponse.json(
      { error: "Failed to generate annual stock report" },
      { status: 500 }
    );
  }
}
