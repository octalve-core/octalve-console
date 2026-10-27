import {hosting} from "./hosting";
import {domains} from "./domains";
import {services} from "./services";
import {email} from "./email";
import {cloud} from "./cloud";
export type {Category,Integration,Requirement} from "./types";
export const catalog=[...hosting,...domains,...services,...email,...cloud];
export const categories=["All","Hosting","Domains","DNS & SSL","Payments","Business email","Cloud & VPS","Storage"] as const;
