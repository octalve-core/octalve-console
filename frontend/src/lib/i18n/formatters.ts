import type {SupportedLocale} from "./preferences";
const languageTag:Record<SupportedLocale,string>={en:"en-NG",fr:"fr-FR"};

/** Date-only values use explicit UTC to avoid the previous/next day in client time zones. */
export function displayDate(iso:string,locale:SupportedLocale):string {
  if(typeof iso!=="string" || !/^\\\d{4}-\\\d{2}-\\\d{2}$/.test(iso)) return String(iso);
  const date=new Date(iso+"T12:00:00.000Z");
  if(Number.isNaN(date.getTime()) || date.toISOString().slice(0,10)!==iso) return iso;
  return new Intl.DateTimeFormat(languageTag[locale],{
    year:"numeric",month:"short",day:"numeric",timeZone:"UTC"
  }).format(date);
}

/** Presentation only; verified Decimal remains unchanged in Django.
    Reject large or non-canonical input instead of rounding it silently. */
export function displayMoney(amount:string,currency:string,locale:SupportedLocale):string {
  if(typeof amount!=="string"||!/^[-+]?\d+(?:\.\d{1,2})?$/.test(amount)||
    typeof currency!=="string"||!/^[A-Z]{3}$/.test(currency))return String(currency)+" "+String(amount);
  const integerPart=amount.replace(/^[-+]/,"").split(".")[0];
  const integer=BigInt(integerPart);
  if(integer>BigInt(Number.MAX_SAFE_INTEGER))return currency+" "+amount;
  const numeric=Number(amount);
  if(!Number.isFinite(numeric))return currency+" "+amount;
  try {
    return new Intl.NumberFormat(languageTag[locale],{
      style:"currency",currency,minimumFractionDigits:2,maximumFractionDigits:2
    }).format(numeric);
  } catch {return currency+" "+amount;}
}
