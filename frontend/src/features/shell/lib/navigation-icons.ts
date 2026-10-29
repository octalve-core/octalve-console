import {
 BarChart3,BookOpen,Boxes,CreditCard,Globe2,LayoutDashboard,LifeBuoy,ListChecks,
 PackageCheck,ReceiptText,Server,Settings,Shield,ShoppingCart,Ticket,UserRound,Users,Bell,UsersRound,
 WalletCards,Zap,Gift,Award,type LucideIcon
} from "lucide-react";
import type {DashboardNavIcon} from "@/lib/navigation/dashboard-nav";
/** Shared authorized sidebar and mobile navigation icon registry. */
export const navigationIcons:Record<DashboardNavIcon,LucideIcon>={
 layoutDashboard:LayoutDashboard,users:Users,boxes:Boxes,listChecks:ListChecks,
 receiptText:ReceiptText,creditCard:CreditCard,globe2:Globe2,server:Server,
 zap:Zap,lifeBuoy:LifeBuoy,bookOpen:BookOpen,settings:Settings,shield:Shield,
 barChart3:BarChart3,walletCards:WalletCards,shoppingCart:ShoppingCart,
 userRound:UserRound,ticket:Ticket,packageCheck:PackageCheck,bell:Bell,usersRound:UsersRound,gift:Gift,award:Award
};
