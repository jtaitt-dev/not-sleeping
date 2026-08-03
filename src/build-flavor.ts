export type BuildFlavor = "core" | "labs";

export const BUILD_FLAVOR: BuildFlavor = __NOT_SLEEPING_BUILD_FLAVOR__;
export const IS_LABS_BUILD = BUILD_FLAVOR === "labs";
