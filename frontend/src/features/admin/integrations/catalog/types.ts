export type Category="Hosting"|"Domains"|"DNS & SSL"|"Payments"|"Business email"|"Cloud & VPS"|"Storage";
export type Requirement={label:string;guidance:string;sensitive?:boolean};
export type Integration={slug:string;name:string;category:Category;summary:string;documentation:string;guide:string;
 requirements:readonly Requirement[];capabilities:readonly string[];logo?:string;stage:"Research"|"Read-only"|"Planned"};
