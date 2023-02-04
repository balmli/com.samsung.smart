import figures from "figures";
import { Settings } from "./Settings";

export const Log = (...props: any[]) => {
  // @ts-ignore
  console.log(figures(...props));
};

export const settings = new Settings();
