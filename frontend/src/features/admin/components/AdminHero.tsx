import {WorkspaceWelcomePanel} from "@/components/data/WorkspaceWelcomePanel";
export function AdminHero({name="Admin"}:{name?:string}){
 return <WorkspaceWelcomePanel name={name} audience="admin"/>;
}
