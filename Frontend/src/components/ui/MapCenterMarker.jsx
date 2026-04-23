export default function MapCenterMarker({ size = "md" }) {
    // cho phép resize sau này
    const sizeMap = {
      sm: {
        outer: "w-14 h-14",
        middle: "w-8 h-8",
        dot: "w-2.5 h-2.5",
      },
      md: {
        outer: "w-20 h-20",
        middle: "w-12 h-12",
        dot: "w-3.5 h-3.5",
      },
      lg: {
        outer: "w-28 h-28",
        middle: "w-16 h-16",
        dot: "w-4 h-4",
      },
    };
  
    const s = sizeMap[size];
  
    return (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[500] pointer-events-none">

        <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center animate-[ripple_2.5s_infinite]">
          
          <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
            
            <div className="w-3.5 h-3.5 rounded-full bg-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.3)]" />
          
          </div>
        </div>
      </div>
    );
  }