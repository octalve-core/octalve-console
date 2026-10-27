import type {SupportedLocale} from "./preferences";

/** Shared presentation strings only. Identifiers, invoices and provider fields are never translated. */
export const copy = {
  en: {
    skip: "Skip to main content", closeSidebar: "Close sidebar",
    nav: "Console navigation", help: "Need help?", assistance: "Support and assistance",
    logout: "Log out", loggingOut: "Signing out…",
    menu: "Open navigation", support: "Support centre", notifications: "View notifications",
    searchOpen: "Search Console pages", searchClose: "Close page search",
    searchLabel: "Find a Console page", searchHint: "Find a page", searchResults: "Console search results",
    accountMenu: "Account menu", accountOptions: "Account options",
    clientConsole: "Client Console", adminConsole: "Admin Console", staffConsole: "Staff Console",
    accountSettings: "Profile and settings", myAccount: "My account",
    expand: "Expand", collapse: "Collapse",
    languageTitle: "Language", languageDescription: "Choose your account language preference.",
    currentLanguage: "Current preference:", saveLanguage: "Save language",
    languageSaved: "Language preference saved.",
    languageError: "Language preference could not be saved. Please try again.",
    languageLoadError: "Language settings are unavailable. Please try again later.",
    languageLoading: "Loading language preference…",
    languagePending: "English is currently the only supported Console language. Other languages will become available after review.",
    languagePilot: "Translation pilot: shared navigation and selected account screens are translated. Other screens, invoices and legal text remain in English.",
    settings: "Settings", settingsIntro: "Your account and personal preferences.",
    account: "Account", accountIntro: "Update your contact information, password and account security.",
    manageProfile: "Manage profile",
    servicesRecent: "Your services", servicesRecentDesc: "Your latest hosting and cloud services.",
    invoicesRecent: "Unpaid invoices", invoicesRecentDesc: "Keep track of invoices awaiting payment.",
    dashboard: "My dashboard", dashboardIntro: "Manage hosting, domains, billing and support.",
    viewAll: "View all", updating: "Updating your account…",
    unavailable: "We couldn't load these details right now.",
    empty: "Nothing to show here yet.",
    categoriesUnavailable: "Categories temporarily unavailable",
    dashboardReminders: "Dashboard reminders", invoiceAlerts: "Invoice alerts on dashboard",
    domainAlerts: "Domain alerts on dashboard",
  },
  fr: {
    skip: "Aller au contenu principal", closeSidebar: "Fermer le menu",
    nav: "Navigation de la console", help: "Besoin d’aide ?", assistance: "Assistance et support",
    logout: "Se déconnecter", loggingOut: "Déconnexion…",
    menu: "Ouvrir la navigation", support: "Centre d’assistance", notifications: "Afficher les notifications",
    searchOpen: "Rechercher dans la console", searchClose: "Fermer la recherche",
    searchLabel: "Rechercher une page de la console", searchHint: "Rechercher une page", searchResults: "Résultats de la recherche",
    accountMenu: "Menu du compte", accountOptions: "Options du compte",
    clientConsole: "Espace client", adminConsole: "Espace administrateur", staffConsole: "Espace équipe",
    accountSettings: "Profil et paramètres", myAccount: "Mon compte",
    expand: "Développer", collapse: "Réduire",
    languageTitle: "Langue", languageDescription: "Choisissez la langue de préférence de votre compte.",
    currentLanguage: "Langue choisie :", saveLanguage: "Enregistrer la langue",
    languageSaved: "Votre préférence linguistique a été enregistrée.",
    languageError: "Impossible d’enregistrer la langue. Veuillez réessayer.",
    languageLoadError: "Les paramètres linguistiques sont indisponibles. Réessayez plus tard.",
    languageLoading: "Chargement des paramètres linguistiques…",
    languagePending: "L’anglais est actuellement la seule langue disponible.",
    languagePilot: "Version pilote : la navigation et certaines pages de compte sont traduites. Les autres pages, les factures et les textes juridiques restent en anglais.",
    settings: "Paramètres", settingsIntro: "Votre compte et vos préférences personnelles.",
    account: "Compte", accountIntro: "Modifiez vos coordonnées, votre mot de passe et la sécurité du compte.",
    manageProfile: "Gérer le profil",
    servicesRecent: "Vos services", servicesRecentDesc: "Vos derniers services d’hébergement et de cloud.",
    invoicesRecent: "Factures impayées", invoicesRecentDesc: "Consultez les factures en attente de paiement.",
    dashboard: "Tableau de bord", dashboardIntro: "Gérez l’hébergement, les domaines, la facturation et l’assistance.",
    viewAll: "Tout afficher", updating: "Actualisation de votre compte…",
    unavailable: "Impossible de charger ces informations pour le moment.",
    empty: "Aucun élément à afficher pour le moment.",
    categoriesUnavailable: "Catégories temporairement indisponibles",
    dashboardReminders: "Rappels du tableau de bord", invoiceAlerts: "Alertes de facturation sur le tableau de bord",
    domainAlerts: "Alertes de domaines sur le tableau de bord",
  },
} satisfies Record<SupportedLocale,Record<string,string>>;

const frenchNav:Record<string,string> = {
  "Command":"Commandes","Commerce":"Commerce","Infrastructure":"Infrastructure",
  "Operations":"Opérations","Account":"Compte","Help":"Aide","Console":"Console",
  "Overview":"Vue d’ensemble","Customers":"Clients","Staff":"Équipe","Category":"Catégories",
  "Products":"Produits","Plans":"Forfaits","Orders":"Commandes","Invoices":"Factures",
  "Transactions":"Transactions","Services":"Services","Domains":"Domaines",
  "Gateways":"Passerelles","Providers":"Fournisseurs","Provisioning":"Provisionnement",
  "Support":"Assistance","Knowledge Base":"Centre d’aide","Rewards":"Récompenses",
  "Reports":"Rapports","Audit Logs":"Journal d’audit","Route Audit":"Audit des pages",
  "Settings":"Paramètres","Purchases":"Achats","Wallet":"Portefeuille",
  "Notifications":"Notifications","O-Cloud Clan":"Communauté O-Cloud",
  "Profile":"Profil","Tickets":"Tickets","Security":"Sécurité",
  "My Services":"Mes services","Order New Service":"Commander un service",
  "My Domains":"Mes domaines","Register New Domain":"Enregistrer un domaine",
  "Transfer Domain to Us":"Transférer un domaine",
};
/** Never change the route, item ID, provider name or dynamic catalogue label. */
export function translateNavigationLabel(value:string,locale:SupportedLocale):string {
  return locale==="fr" ? (frenchNav[value]??value) : value;
}

export function messages(locale:SupportedLocale) {
  return copy[locale];
}
