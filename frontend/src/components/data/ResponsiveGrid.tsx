import type { ReactNode } from "react";
import {WorkspaceGrid,type WorkspaceGridVariant} from "@/components/design-system/WorkspaceGrid";
type ResponsiveGridProps={
  children: ReactNode;
  className?: string;
  columns?: "2"|"3"|"4";
};
/** Backward-compatible public contract; grid geometry is locally scoped.
 * No unlayered legacy .grid can override the 640/1280px column breakpoints.
 */
export function ResponsiveGrid({children,className,columns="3"}:ResponsiveGridProps){
  const variant:WorkspaceGridVariant=columns==="2"?"responsive2":columns==="4"?"responsive4":"responsive3";
  return <WorkspaceGrid variant={variant} className={className}>{children}</WorkspaceGrid>;
}
