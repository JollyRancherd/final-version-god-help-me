import React, { useState } from "react";
import { formatMoney } from "@/lib/budget-utils";
import { useUpdateSettings } from "@/hooks/use-settings";
import { Edit2 } from "lucide-react";

interface ProgressRingProps {
  value: string | number;
  max: number;
  label: string;
  color: string;
  settingsKey: "emergencyFund" | "apartmentFund" | "debtPaid";
}

export function ProgressRing({ value, max, label, color, settingsKey }: ProgressRingProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const updateSettings = useUpdateSettings();

  const numValue = Number(value || 0);
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((numValue / max) * 100));

  const handleUpdate = () => {
    const v = parseFloat(editValue);
    if (!Number.isNaN(v) && v >= 0) {
      updateSettings.mutate({ [settingsKey]: v.toFixed(2) });
    }
    setIsEditing(false);
  };

  return (
    <div className="glass-panel p-4 flex flex-col items-center justify-center text-center hover-lift relative group">
      <div 
        className="w-24 h-24 rounded-full flex items-center justify-center relative mb-4"
        style={{
          background: `conic-gradient(${color} ${pct}%, rgba(8,15,29,0.9) ${pct}% 100%)`
        }}
      >
        <div className="w-20 h-20 bg-card rounded-full flex flex-col items-center justify-center z-10 shadow-inner">
          <span className="text-sm font-bold text-white">{pct}%</span>
          <span className="text-xs text-muted-foreground">${numValue.toFixed(0)}</span>
        </div>
      </div>
      
      <div className="text-sm font-bold text-foreground">{label}</div>
      <div className="text-xs text-muted-foreground mt-1 font-mono">
        {formatMoney(numValue)} / {formatMoney(max)}
      </div>

      {isEditing ? (
        <div className="mt-3 flex items-center gap-2">
          <input
            autoFocus
            type="number"
            className="w-20 bg-background border border-border/50 rounded-md px-2 py-1 text-xs text-center outline-none focus:border-primary"
            defaultValue={numValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
            onBlur={handleUpdate}
          />
        </div>
      ) : (
        <button 
          onClick={() => setIsEditing(true)}
          className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-xs font-medium flex items-center gap-1.5 border border-white/10"
        >
          <Edit2 className="w-3 h-3" /> Update
        </button>
      )}
    </div>
  );
}
