export default function Loading() {
  return (
    <div className="w-full h-full flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium animate-pulse">Loading...</p>
      </div>
    </div>
  );
}
