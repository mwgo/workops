import * as SDK from "azure-devops-extension-sdk";
import { ToolsSetup } from "./Tools";

import { 
    getClient,
    CommonServiceIds, 
    IProjectPageService,
    IProjectInfo
} from "azure-devops-extension-api";
import * as TfsCore from "azure-devops-extension-api/Core";
import * as TfsWIT from "azure-devops-extension-api/WorkItemTracking";
import * as TfsClient from "azure-devops-extension-api/Work/WorkClient";
import * as TfsWork from "azure-devops-extension-api/Work";

import { ITreeItem, ITreeItemEx, TreeItemProvider } from "azure-devops-ui/Utilities/TreeItemProvider";
import { IListBoxItem } from "azure-devops-ui/ListBox";

import { ISimpleTableCell } from "azure-devops-ui/Table";
import { ISimpleListCell } from "azure-devops-ui/List";
import { Styles } from "./Styles";


export interface IIterationItem {
    id: string;
    text: string;
    iteration: TfsWork.TeamSettingsIteration;
}

export interface IWorkItem extends ISimpleTableCell {
    id: string;
    title: ISimpleListCell;
    state: ISimpleListCell;
    assignedTo: string;
    area: string;
    priority: number;
    // workItem: TfsWIT.WorkItem;
}

export class Data {

    CurrentProject?: IProjectInfo;
    CurrentProjectID = "";
    CurrentIterationPath = "";

    WorkItems: ITreeItem<IWorkItem>[] = [];
    Iterations: IListBoxItem<IIterationItem>[] = [];

    TaskFilter = "Current";
    static TaskFilterValaues = ["Current", "New+Current", "Done", "All"];

    static LoadingItem: ITreeItem<IWorkItem> = {
        childItems: [],
        data: {
            id: "loading",
            title: { 
                text: "loading...",
                iconProps: Styles.LoadingIcon
            },
            state: {
                text: ""
            },
            assignedTo: "",
            area: "",
            priority: 0
        },
        expanded: false
    };
    WorkItemsProvider = new TreeItemProvider<IWorkItem>([Data.LoadingItem]);

    async initialize(): Promise<void> {
        await SDK.ready();

        await this.loadProject();
        if (!this.CurrentProject) return;

        this.Iterations = await this.loadIterations();
        this.WorkItems = await this.loadItems();
        this.WorkItemsProvider = new TreeItemProvider(this.WorkItems);
    }

    async reloadItems() {
        this.WorkItems = await this.loadItems();
        this.WorkItemsProvider = new TreeItemProvider(this.WorkItems);
    }

    private async loadProject(): Promise<void> {
        const navService = await SDK.getService<IProjectPageService>(CommonServiceIds.ProjectPageService);
        let project = await navService.getProject();
        if (project) {
            this.CurrentProject = project;
            this.CurrentProjectID = project.id;
        }
    }

    private async loadIterations(): Promise<IListBoxItem<IIterationItem>[]> {
        if (!this.CurrentProject) return [];

        let coreClient = getClient(TfsCore.CoreRestClient);
        let workClient = getClient(TfsClient.WorkRestClient);

        let projectId = this.CurrentProjectID;
        let teams = await coreClient.getTeams(this.CurrentProjectID, true, 50);
        let titerations = await Promise.all(teams.map(team => {
            let teamContext: TfsCore.TeamContext = { projectId: projectId, teamId: team.id, project: "", team: "" };
            return workClient.getTeamIterations(teamContext);
        }));

        let time = new Date().getTime() - 40*24*60*60*1000;
        let iterations: TfsWork.TeamSettingsIteration[] = [];
        for (const tit of titerations) {
            for (const it of tit) {
                if (!it.attributes.finishDate || it.attributes.finishDate.getTime()>time) 
                    if (iterations.findIndex(i => it.id==i.id)<=0)
                        iterations.push(it);
            }
        }

        let iter = iterations.first(i => Data.isCurrentIteration(i));
        this.CurrentIterationPath = iter ? iter.path : "";

        return iterations.map(it => { 
            let sufix = "";
            if (this.CurrentIterationPath==it.path) sufix += " (Current)";
            return { 
                id: it.path, 
                text: it.name+sufix,
                iteration: it,
                iconProps: { iconName: "Sprint" }
            }; 
        });
    }

    private static isCurrentIteration(iter: TfsWork.TeamSettingsIteration): boolean {
        let dt = Date.now();
        
        let start = iter.attributes.startDate;
        if (!start) start = new Date();

        let finish = iter.attributes.finishDate;
        if (!finish) finish = new Date();
        finish.setDate(finish.getDate()+1);

        return start.getTime()<=dt && dt<finish.getTime();
    }

    private async loadItems(): Promise<ITreeItem<IWorkItem>[]> {
        if (!this.CurrentProject) return [];
        
        try {
            const client = getClient(TfsWIT.WorkItemTrackingRestClient);

            let iter: string;
            if (this.CurrentIterationPath)
                iter = "'"+this.CurrentIterationPath+"'";
            else
                iter = "@CurrentIteration";

            let stateFilter = "'Ready', 'Active'";
            if (this.TaskFilter=="New+Current")
                stateFilter = "'New', 'Ready', 'Active'";
            if (this.TaskFilter=="Done")
                stateFilter = "'Resolved', 'Closed'";
            if (this.TaskFilter=="All")
                stateFilter = "'New', 'Ready', 'Active', 'Resolved', 'Closed', 'Removed'";
    
            let topWiql = {
                query: "SELECT * FROM WorkItemLinks WHERE [Link Type] = 'Child'"+
                            " AND [Target].[System.AssignedTo]=@me"+
                            " AND [Target].[Iteration Path]="+iter+
                            " AND [Target].[System.WorkItemType]='Task'"+
                            " AND [Target].[System.State] IN ("+stateFilter+")"
            };

            stateFilter = "'Ready', 'Active'";
            if (this.TaskFilter=="Done")
                stateFilter = "'Closed'";
            if (this.TaskFilter=="All")
                stateFilter = "'Ready', 'Active', 'Closed'";

            let topWiql2 = {
                query: "SELECT * FROM WorkItems WHERE [System.AssignedTo]=@me"+
                            " AND [Iteration Path]="+iter+
                            " AND [System.WorkItemType] IN ('Bug', 'User Story', 'Impediment')"+
                            " AND [System.State] IN ("+stateFilter+")"
            };

            let top = await Promise.all([
                client.queryByWiql(topWiql, this.CurrentProjectID),
                client.queryByWiql(topWiql2, this.CurrentProjectID)
            ]);

            if (!top[0] || !top[1]) return [];

            let topItems = top[0].workItemRelations.filter(item => !item.rel).map(item => item.target.id);
            topItems = topItems.concat(top[1].workItems.map(item => item.id));
            if (topItems.length==0) return [];

            let childrenWiql = {
                query: "SELECT * FROM WorkItemLinks WHERE [Link Type] = 'Child' AND [Source].[Id] IN ("+topItems.join(",")+")"
            };
            let childrenRels = await client.queryByWiql(childrenWiql, this.CurrentProjectID);
            let childrenItems = childrenRels.workItemRelations.filter(item => item.rel).map(item => item.target.id);
            
            let items = await client.getWorkItems(topItems.concat(childrenItems), this.CurrentProjectID, 
                undefined, undefined,
                TfsWIT.WorkItemExpand.Relations);

            let result = items
                .filter(it => it.fields["System.WorkItemType"]!="Task")
                .map(it => ({
                    childItems: this.getTreeChildren(it, items, childrenRels.workItemRelations),
                    data: this.getTreeItem(it),
                    expanded: false
                }));

            return result;
        }
        catch (e) {
            return [];
        }
    }

    private getTreeItem(it: TfsWIT.WorkItem): IWorkItem {
        let assigned = it.fields["System.AssignedTo"];

        let typeName = it.fields["System.WorkItemType"] as string;
        let typeIcon = Styles.TypesMap[typeName] || Styles.TypesMap[""];

        let state = it.fields["System.State"] as string;
        let stateIcon = Styles.StatesMap[state] || Styles.StatesMap[""];

        let isActive = state=="Active" || state=="Ready";
        let isMy = assigned.uniqueName=="@me"; // Ale to trzeba poprawić

        let pr = "";
        for (const r of it.relations) {
            if (r.rel=="ArtifactLink") {
                if (r.url.indexOf("/PullRequestId/")>=0) pr = r.url; //'vstfs:///Git/PullRequestId/a86b1277-1813-42fb-81b6-023cf4f8f82b%2F50a99e50-41a3-4f2c-b11b-8a4b71b9f4cf%2F4538'
            }
        }

        return {
            // workItem: it,
            id: it.id.toString(),
            title: { 
                text: it.id + ": " + it.fields["System.Title"] as string,
                iconProps: typeIcon,
                textClassName: "currentlist"+(isActive ? "-active" : "")+(isMy ? "-my" : "")+"-text"
            },
            state: {
                text: state,
                iconProps: stateIcon
            },
            assignedTo: (assigned ? assigned.displayName : "") as string,
            area: it.fields["System.AreaPath"] as string,
            priority: it.fields["Microsoft.VSTS.Common.Priority"] as number
        };
    }

    private getTreeChildren(item: TfsWIT.WorkItem, items: TfsWIT.WorkItem[], links: TfsWIT.WorkItemLink[]): ITreeItem<IWorkItem>[] | undefined {
        if (item.fields["System.WorkItemType"]=="Task") return undefined;

        let children = links
            .filter(l => l.source && l.target && l.source.id==item.id)
            .map(l => items.first(it => it.id==l.target.id))
            .map(it => ({
                childItems: it ? this.getTreeChildren(it, items, links) : [],
                data: this.getTreeItem(it),
                expanded: false
            }));

        return children;
    }

}

ToolsSetup();