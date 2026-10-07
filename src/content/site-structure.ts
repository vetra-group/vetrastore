import type { IconName } from "@/components/Icon";
import { honey } from "@/lib/catalog";

// Display order and destinations live beside their stable content keys.
export const mainNavigation = [
  { key: "home", path: "" },
  { key: "shop", path: "/products" },
  { key: "story", path: "/about" },
  { key: "journal", path: "/blog" },
] as const;
export type MainNavigationKey = (typeof mainNavigation)[number]["key"];

export const footerNavigation = [
  { key: "allProducts", path: "/products" },
  { key: "ourStory", path: "/about" },
  { key: "theJournal", path: "/blog" },
  { key: "shippingReturns", path: "/help#shipping" },
  { key: "contact", path: "/contact" },
] as const;
export type FooterLinkKey = (typeof footerNavigation)[number]["key"];

export const heroSlides = [
  { key: "blossoms", src: "/images/hero-eshan-1.webp", path: "/coffee-blossom-honey" },
  { key: "coffeeCup", src: "/images/hero-eshan-2.webp", path: "/coffee-blossom-honey" },
  { key: "ceramicBowl", src: "/images/hero-eshan-3.webp", path: "/coffee-blossom-honey" },
  { key: "honeyDipper", src: "/images/hero-eshan-4.webp", path: "/coffee-blossom-honey" },
  { key: "coffeeLandscape", src: "/images/hero-coffee-landscape.webp", path: "/about" },
  { key: "morningRitual", src: "/images/hero-honey-ritual.webp", path: "/blog/simple-honey-pairings" },
] as const;
export type HeroSlideKey = (typeof heroSlides)[number]["key"];

export const trustItems = [
  { key: "productKnowledge", icon: "productSearch" },
  { key: "wholesaleRetail", icon: "stock" },
  { key: "consultation", icon: "consultation" },
] as const satisfies readonly { key: string; icon: IconName }[];
export type TrustItemKey = (typeof trustItems)[number]["key"];

export const homeCollections = [
  {
    key: "honey",
    path: "/coffee-blossom-honey",
    image: honey.image,
    imageStyle: "honey",
  },
  {
    key: "coffee",
    path: "/products?category=coffee",
    image: "/images/coffee-beans.webp",
    imageStyle: "standard",
    comingSoon: "untilCoffeeAvailable",
  },
  {
    key: "instantCoffee",
    path: "/products?category=coffee",
    image: "/images/coffee-ritual.webp",
    imageStyle: "standard",
    comingSoon: "always",
  },
] as const;
export type HomeCollectionKey = (typeof homeCollections)[number]["key"];

