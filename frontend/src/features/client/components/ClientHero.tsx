import {WorkspaceWelcomePanel} from "@/components/data/WorkspaceWelcomePanel";
export function ClientHero({name="Client"}:{name?:string}){
 return <WorkspaceWelcomePanel name={name} audience="client"/>;
}
