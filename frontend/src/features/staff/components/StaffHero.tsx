import {WorkspaceWelcomePanel} from "@/components/data/WorkspaceWelcomePanel";
export function StaffHero({name="Staff"}:{name?:string}){
 return <WorkspaceWelcomePanel name={name} audience="staff"/>;
}
