import { FilmIcon, HouseIcon } from "lucide-react";

// `exact` items only highlight on their own path; others also highlight on nested routes.
export const navItems = [
  { title: "Home", to: "/", icon: HouseIcon, exact: true },
  { title: "Movies", to: "/movies", icon: FilmIcon, exact: false },
] as const;
