declare const __NOT_SLEEPING_BUILD_FLAVOR__: "core" | "labs";

declare module "virtual:not-sleeping-labs-workspace" {
  import type { ComponentType } from "react";

  const Workspace: ComponentType;
  export default Workspace;
}
