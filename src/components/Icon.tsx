import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Check,
  ChevronLeft,
  ChevronRight,
  Heart,
  Leaf,
  Mail,
  Menu,
  MessagesSquare,
  Minus,
  Package,
  PackageSearch,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sun,
  Trash2,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import type { CSSProperties } from "react";

const icons = {
  arrow: ArrowRight,
  arrowLeft: ArrowLeft,
  arrowUpRight: ArrowUpRight,
  search: Search,
  bag: ShoppingBag,
  user: UserRound,
  leaf: Leaf,
  shield: ShieldCheck,
  truck: Truck,
  heart: Heart,
  menu: Menu,
  close: X,
  minus: Minus,
  plus: Plus,
  check: Check,
  chevron: ChevronRight,
  chevronLeft: ChevronLeft,
  mail: Mail,
  sun: Sun,
  box: Package,
  productSearch: PackageSearch,
  stock: Boxes,
  consultation: MessagesSquare,
  trash: Trash2,
} as const;

export type IconName = keyof typeof icons;
export default function Icon({
  name,
  size = 20,
  className,
  style,
}: {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const LucideIcon = icons[name];
  return (
    <LucideIcon
      size={`${size / 16}rem`}
      strokeWidth={1.5}
      aria-hidden="true"
      focusable="false"
      className={className}
      style={style}
    />
  );
}
