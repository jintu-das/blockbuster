import { FolderOpenIcon, HouseIcon } from "lucide-react";

// `exact` items only highlight on their own path; others also highlight on nested routes.
export const navItems = [
  { title: "Home", to: "/", icon: HouseIcon, exact: true },
  { title: "Libraries", to: "/libraries", icon: FolderOpenIcon, exact: false },
] as const;
