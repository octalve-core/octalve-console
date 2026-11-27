export const resourceIdPattern = /^(?:[1-9][0-9]{0,14}|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/;
export function validResourceId(value:unknown):value is string {return typeof value==="string"&&resourceIdPattern.test(value);}
export function publicResourceId(value:unknown, fallback:string|number):string {return validResourceId(value)&&value.includes("-")?value:String(fallback);}
