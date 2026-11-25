import {
 BarChart3,BookOpen,Boxes,CreditCard,Globe,LayoutGrid,Headset,ListChecks,
 Package,ReceiptText,Server,Settings,ShieldCheck,ShoppingCart,Ticket,UserRound,Users,Bell,UsersRound,
 Wallet,Zap,Gift,Award,type LucideIcon
} from "lucide-react";
import type {DashboardNavIcon} from "@/lib/navigation/dashboard-nav";
/** Shared authorized sidebar and mobile navigation icon registry. */
export const navigationIcons:Record<DashboardNavIcon,LucideIcon>={
 layoutDashboard:LayoutGrid,users:Users,boxes:Boxes,listChecks:ListChecks,
 receiptText:ReceiptText,creditCard:CreditCard,globe2:Globe,server:Server,
 zap:Zap,lifeBuoy:Headset,bookOpen:BookOpen,settings:Settings,shield:ShieldCheck,
 barChart3:BarChart3,walletCards:Wallet,shoppingCart:ShoppingCart,
 userRound:UserRound,ticket:Ticket,packageCheck:Package,bell:Bell,usersRound:UsersRound,gift:Gift,award:Award
};
