import { CirclePlayIcon, EyeOffIcon, FilmIcon, HouseIcon, MonitorPlayIcon } from "lucide-react";
import { MOVIE_VIEWS, type MovieFilters } from "@/features/movies";

// `exact` items only highlight on their own path; others also highlight on nested routes.
export const navItems = [
  { title: "Home", to: "/", icon: HouseIcon, exact: true },
  { title: "Movies", to: "/movies", icon: FilmIcon, exact: false },
] as const;

/** Shortcuts to the Movies page with one preset view; each counts the movies it would show. */
export const quickViews: { title: string; icon: typeof FilmIcon; search: MovieFilters }[] = [
  { title: "Continue watching", icon: CirclePlayIcon, search: MOVIE_VIEWS.continueWatching },
  { title: "Unwatched", icon: EyeOffIcon, search: MOVIE_VIEWS.unwatched },
  { title: "4K", icon: MonitorPlayIcon, search: MOVIE_VIEWS.fourK },
];
