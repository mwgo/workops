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
import * as TfsGit from "azure-devops-extension-api/Git";

import { ITreeItem, TreeItemProvider } from "azure-devops-ui/Utilities/TreeItemProvider";
import { IListBoxItem } from "azure-devops-ui/ListBox";

import { ISimpleTableCell } from "azure-devops-ui/Table";
import { ISimpleListCell } from "azure-devops-ui/List";
import { Styles } from "./Styles";
import React = require("react");
import { LinkItem } from "./LinkItem";


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
    CurrentUser?: SDK.IUserContext;
    CurrentIterationPath = "";

    WorkItems: ITreeItem<IWorkItem>[] = [];
    Iterations: IListBoxItem<IIterationItem>[] = [];

    TaskFilter = "Current";
    static TaskFilterValues = ["Current", "New+Current", "Done", "All"];
    UserFilter = "@me";
    UserFilterValues = ["@me"];

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

    private async loadProject(): Promise<void> {
        const navService = await SDK.getService<IProjectPageService>(CommonServiceIds.ProjectPageService);
        this.CurrentProject = await navService.getProject();
        this.CurrentUser = SDK.getUser();
    }

    async reloadItems() {
        this.WorkItems = await this.loadItems();
        this.WorkItemsProvider = new TreeItemProvider(this.WorkItems);
    }

    private async loadIterations(): Promise<IListBoxItem<IIterationItem>[]> {
        if (!this.CurrentProject) return [];

        let coreClient = getClient(TfsCore.CoreRestClient);
        let workClient = getClient(TfsClient.WorkRestClient);

        let projectId = this.CurrentProject.id;

        let teams = await coreClient.getTeams(this.CurrentProject.id, true, 50);

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

        let iterIdx = iterations.findIndex(i => Data.isCurrentIteration(i));
        if (iterIdx<0) iterIdx = iterations.findIndex(i => Data.isCurrentIteration2(i));

        if (iterIdx<0 && iterations.length>0) iterIdx = iterations.length-1;
        this.CurrentIterationPath = iterIdx<0 ? "" : iterations[iterIdx].path;

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

    private static isCurrentIteration2(iter: TfsWork.TeamSettingsIteration): boolean {
        let dt = Date.now();
        
        let start = iter.attributes.startDate;
        if (!start || dt>start.getTime()) return false;

        let finish = iter.attributes.finishDate;
        if (finish && dt>finish.getTime()) return false;

        return true;
    }

    AllItems: TfsWIT.WorkItem[] = [];
    AllLinks: TfsWIT.WorkItemLink[] = [];

    private async loadItems(): Promise<ITreeItem<IWorkItem>[]> {
        if (!this.CurrentProject) return [];
        
        try {
            const client = getClient(TfsWIT.WorkItemTrackingRestClient);

            let iter = "@CurrentIteration";
            if (this.CurrentIterationPath)
                iter = "'"+this.CurrentIterationPath+"'";
            let user = this.UserFilter;
            if (user.substring(0, 1)!="@")
                user = "'"+user+"'";
    
            let stateFilter = "'Ready', 'Active'";
            if (this.TaskFilter=="New+Current")
                stateFilter = "'New', 'Ready', 'Active'";
            if (this.TaskFilter=="Done")
                stateFilter = "'Resolved', 'Closed'";
            if (this.TaskFilter=="All")
                stateFilter = "'New', 'Ready', 'Active', 'Resolved', 'Closed', 'Removed'";
    
            let topWiql = {
                query: "SELECT * FROM WorkItemLinks WHERE [Link Type] = 'Child'"+
                            " AND [Target].[System.AssignedTo]="+user+
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
                query: "SELECT * FROM WorkItems WHERE [System.AssignedTo]="+user+
                            " AND [Iteration Path]="+iter+
                            " AND [System.WorkItemType] IN ('Bug', 'User Story', 'Impediment')"+
                            " AND [System.State] IN ("+stateFilter+")"
            };

            let top = await Promise.all([
                client.queryByWiql(topWiql, this.CurrentProject.id),
                client.queryByWiql(topWiql2, this.CurrentProject.id)
            ]);

            if (!top[0] || !top[1]) return [];

            let topItems = top[0].workItemRelations.filter(item => !item.rel).map(item => item.target.id);
            topItems = topItems.concat(top[1].workItems.map(item => item.id));
            if (topItems.length==0) return [];

            let childrenWiql = {
                query: "SELECT * FROM WorkItemLinks WHERE [Link Type] = 'Child' AND [Source].[Id] IN ("+topItems.join(",")+")"
            };
            let childrenRels = await client.queryByWiql(childrenWiql, this.CurrentProject.id);
            this.AllLinks = childrenRels.workItemRelations;
            let childrenItems = this.AllLinks.filter(item => item.rel).map(item => item.target.id);
            
            this.AllItems = await client.getWorkItems(topItems.concat(childrenItems), this.CurrentProject.id, 
                undefined, undefined,
                TfsWIT.WorkItemExpand.Relations);

            this.updateUsers();
                
            let stories = this.AllItems.filter(it => it.fields["System.WorkItemType"]!="Task")

            let areas = stories
                .map(it => it.fields["System.AreaPath"] as string)
                .sort();
            areas = areas.filter((item, idx) => areas.indexOf(item)==idx); 

            let result = areas.map(a => this.getAreaItem(a, stories));

            return result;
        }
        catch (e) {
            return [];
        }
    }

    private updateUsers(): void {
        this.UserFilterValues = [];
        for (const wi of this.AllItems) {
            let s0 = wi.fields["System.AssignedTo"].uniqueName as string;
            let s1 = wi.fields["System.ChangedBy"].uniqueName as string;
            let s2 = wi.fields["System.CreatedBy"].uniqueName as string;

            if (this.UserFilterValues.indexOf(s0)<0) this.UserFilterValues.push(s0);
            if (this.UserFilterValues.indexOf(s1)<0) this.UserFilterValues.push(s1);
            if (this.UserFilterValues.indexOf(s2)<0) this.UserFilterValues.push(s2);
        }
        this.UserFilterValues.sort();
        this.UserFilterValues.splice(0, 0, "@me");
    }

    private getAreaItem(path: string, items: TfsWIT.WorkItem[]): ITreeItem<IWorkItem> {
        return {
            childItems: items
                .filter(it => it.fields["System.AreaPath"]==path)
                .map(it => ({
                    childItems: this.getTreeChildren(it),
                    data: this.getTreeItem(it),
                    expanded: false
                })),
            data: {
                id: "area"+path,
                title: { 
                    text: path,
                    iconProps: Styles.AreaIcon,
                    textClassName: "currentlist-area-text"
                },
                state: {
                    text: ""
                },
                assignedTo: "",
                area: "",
                priority: 0
            },
            expanded: true
        }
    }

    private getChildrenItems(item: TfsWIT.WorkItem): TfsWIT.WorkItem[] {
        let result = this.AllLinks
            .filter(l => l.source && l.target && l.source.id==item.id)
            .map(l => this.AllItems.first(it => it.id==l.target.id));
        return result;
    }
            
    private getRecursiveItems(item: TfsWIT.WorkItem): TfsWIT.WorkItem[] {
        let t = [item];

        let scan = (it: TfsWIT.WorkItem) => {
            let r = this.getChildrenItems(it);
            t = t.concat(r);
            r.forEach(scan);
        }
        scan(item);

        return t;
    }
            
    private getTreeChildren(item: TfsWIT.WorkItem): ITreeItem<IWorkItem>[] | undefined {
        if (item.fields["System.WorkItemType"]=="Task") return undefined;

        let children = this.getChildrenItems(item)
            .map(it => ({
                childItems: it ? this.getTreeChildren(it) : [],
                data: this.getTreeItem(it),
                expanded: false
            }));

        return children;
    }

    private getRelations(it: TfsWIT.WorkItem): { type: string, link: string }[] {
        let t: { type: string, link: string }[] = [];
        for (let r of it.relations.filter(r => r.rel=="ArtifactLink")) {
            t.push({ 
                type: r.url.indexOf("/PullRequestId/")>=0 ? "pr" 
                    : r.url.indexOf("/Commit/")>=0 ? "commit" 
                    : r.url.indexOf("/Ref/")>=0 ? "branch" 
                    : "",
                link: r.url
            });
            if (r.url.indexOf("/PullRequestId/")>=0) 
                t.push({ 
                    type: "prbranch",
                    link: r.url
                });
        }
        return t;
    }

    private getTreeItem(it: TfsWIT.WorkItem): IWorkItem {
        let assigned = it.fields["System.AssignedTo"];

        let typeName = it.fields["System.WorkItemType"] as string;
        let typeIcon = Styles.TypesMap[typeName] || Styles.TypesMap[""];

        let state = it.fields["System.State"] as string;
        let stateIcon = Styles.StatesMap[state] || Styles.StatesMap[""];

        let release = it.fields["Custom.Release"] as string;
        if (!release) release = it.fields["Custom.319d7677-7313-48ce-858e-746a615b8704"] as string;

        let isActive = state=="Active" || state=="Ready";
        let isMy = assigned && this.CurrentUser && assigned.uniqueName==this.CurrentUser.name;

        let n = 0;
        let rels : React.ReactNode[] = this
            .getRelations(it)
            .map(r => React.createElement(LinkItem, { 
                Data: this, 
                Link: r.type + r.link, 
                ID: it.id, 
                Icon: Styles.LinksIcon[r.type], 
                key: it.id + r.type + (n++)
            }));

        let textNode: React.ReactNode = it.fields["System.Title"] as string;
        if (isMy)
            textNode = React.createElement("span", null,
                React.createElement("span", { className: "currentlist-my-id" },
                    it.id+": "
                ),
                textNode
            );
        else
            textNode = it.id + ": " + textNode;

        if (rels.length>0) {
            for (let i = rels.length; --i>0; )
                rels.splice(i, 0, " ");
            textNode = React.createElement("div", null,
                textNode,
                React.createElement("div", null,
                    React.createElement("small", null, 
                        rels
            )));
        }

        let result = {
            // workItem: it,
            id: it.id.toString(),
            title: { 
                text: it.id + ": " + it.fields["System.Title"] as string,
                textNode: textNode,
                iconProps: typeIcon,
                textClassName: isActive ? "currentlist-active-text" : ""
            },
            state: {
                text: state,
                iconProps: stateIcon
            },
            assignedTo: (assigned ? assigned.displayName : "") as string,
            area: it.fields["System.AreaPath"] as string,
            priority: it.fields["Microsoft.VSTS.Common.Priority"] as number,
            release: release
        };

        return result;
    }

    //
    // LINKS
    //

    LinkItems: LinkItem[] = [];
    LinksInfo: { [link: string]: { name: string, title: string, url: string } } = {};

    toggle(item: ITreeItem<IWorkItem>): void {
        let id = parseInt(item.data.id);
        let witem = this.AllItems.find(it => it.id==id);
        if (!witem) return;

        this.retrieveLinks(this.getRecursiveItems(witem));

        this.WorkItemsProvider.toggle(item);
    }

    private async retrieveLinks(items: TfsWIT.WorkItem[]) {
        const tfs = getClient(TfsGit.GitRestClient);

        let changed = false;
        for (const i of items) {
            for (const l of this.getRelations(i)) {
                if (!this.LinksInfo[l.link]) {
                    await this.retrieveLink(tfs, l);
                    changed = true;
                }
            }
        }

        if (changed) {
            let links = this.LinkItems//.filter(l => items.some(i => i.id==l.props.ID));
            links.forEach(it => it.update());
        }
    }

    private async retrieveLink(tfs: TfsGit.GitRestClient, l: { type: string, link: string }) {
        if (l.type=="pr") {
            let s = l.link.substring(l.link.lastIndexOf("/")+1);
            let args = s.split("%2F");

            // vstfs://vstfs:///Git/PullRequestId/[project id]%2F[respository id]%2F[pull request id]

            let pr = await tfs.getPullRequestById(parseInt(args[2]), args[0]);

            let url = pr.url;
            url = url.replace("/_apis/git/repositories/", "/_git/");
            url = url.replace("/pullRequests/", "/pullrequest/");

            this.LinksInfo[l.type+l.link] = {
                name: "!"+pr.pullRequestId + (pr.status==3 ? " [C]" : pr.status==2 ? " [D]" : ""),
                title: pr.title + (pr.status==3 ? " [Completed]" : pr.status==2 ? " [Draft]" : ""),
                url: url
            };

            try {
                let branch = Data.prepareRef(pr.sourceRefName);

                let b = await tfs.getBranch(args[1], branch);

                let i = url.indexOf("/pullrequest/");
                url = url.substring(0, i) + "?version=GB" + branch.replace("/", "%2f");


                this.LinksInfo[l.type+"branch"+l.link] = {
                    name: branch,
                    title: branch + " -> " + Data.prepareRef(pr.targetRefName),
                    url: url
                };
            }
            catch {
            }
        }

        if (l.type=="branch") {
            let s = l.link.substring(l.link.lastIndexOf("/")+1);
            let args = s.split("%2F");
            let projectID = args.shift() || "";
            let repositoryID = args.shift() || "";
            let branchName = args.join("/").substring(2);

            // vstfs:///Git/Ref/[project id]%2F[respository id]%2FGB[branch]

            try {
                let branch = await tfs.getBranch(repositoryID, branchName, projectID);

                let url = branch.commit.url;
                url = url.replace("/_apis/git/repositories/", "/_git/");
                let i = url.indexOf("/commits/");
                url = url.substring(0, i) + "?version="+args.join("%2F");

                this.LinksInfo[l.type+l.link] = {
                    name: branchName,
                    title: branchName + " Commit: " + branch.commit.author.name + " : " + branch.commit.comment,
                    url: url
                };
            }
            catch {
                this.LinksInfo[l.type+l.link] = {
                    name: branchName + " [R]",
                    title: branchName + " [Removed]",
                    url: ""
                };
            }
        }
    }

    private static prepareRef(s: string): string {
        return s.startsWith("refs/heads/") ? s.substring(11) : s;
    }
}

ToolsSetup();