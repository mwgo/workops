import * as React from "react";
import * as SDK from "azure-devops-extension-sdk";
import { 
    getClient,
    CommonServiceIds, 
    IProjectPageService,
    IProjectInfo
 } from "azure-devops-extension-api";
import * as TfsCore from "azure-devops-extension-api/Core";
import * as TfsWIT from "azure-devops-extension-api/WorkItemTracking";
import * as TfsWork from "azure-devops-extension-api/Work/WorkClient";

import { Card } from "azure-devops-ui/Card";
import { ColumnMore, ISimpleTableCell } from "azure-devops-ui/Table";
import { ISimpleListCell } from "azure-devops-ui/List";

import { Tree } from "azure-devops-ui/TreeEx";
import { ITreeItem, ITreeItemEx, TreeItemProvider } from "azure-devops-ui/Utilities/TreeItemProvider";
import { renderExpandableTreeCell, renderTreeCell } from "azure-devops-ui/TreeEx";

import { Dropdown } from "azure-devops-ui/Dropdown";
import { DropdownSelection } from "azure-devops-ui/Utilities/DropdownSelection";
import { IListBoxItem } from "azure-devops-ui/ListBox";
import { IIconProps } from "azure-devops-ui/Icon";

interface IWorkItem extends ISimpleTableCell {
    id: string;
    title: ISimpleListCell;
    state: ISimpleListCell;
    assignedTo: string;
    teamProject: string;
}

interface IIterationItem {
    id: string;
    text: string;
}

export interface ITodoListTabState {
    workItems: TreeItemProvider<IWorkItem>;
    iterations: IListBoxItem<IIterationItem>[];
}

declare global {
    interface Array<T> {
        first(predicate: (value: T, index: number, obj: T[]) => any): T;
    }  
}

if (!Array.prototype.first) {
    Array.prototype.first = function<T>(predicate: (value: T, index: number, obj: T[]) => any) {
        let idx = this.findIndex(predicate);
        if (idx<0) throw "Item not found";
        return this[idx];
    };
}

interface IIconPropsMap {
    [key: string]: IIconProps;
}

export class TodoListTab extends React.Component<{}, ITodoListTabState> {

    private currentProject?: IProjectInfo;
    private currentIterationPath: string = "";

    constructor(props: {}) {
        super(props);

        this.state = {
            iterations: [],
            workItems: new TreeItemProvider<IWorkItem>([])
        };
    }

    public componentDidMount() {
        this.initializeState();
    }

    private async initializeState(): Promise<void> {
        await SDK.ready();

        await this.loadProject();
        if (!this.currentProject) return;

        this.setState({
            iterations: await this.loadIterations(),
            workItems: new TreeItemProvider<IWorkItem>(await this.loadItems())
        });

        this.updateIterationIndex();
    }

    private async loadProject(): Promise<void> {
        const navService = await SDK.getService<IProjectPageService>(CommonServiceIds.ProjectPageService);
        let project = await navService.getProject();
        if (project) this.currentProject = project;
    }

    private async loadIterations(): Promise<IListBoxItem<IIterationItem>[]> {
        if (!this.currentProject) return [];

        let coreClient = getClient(TfsCore.CoreRestClient);
        let workClient = getClient(TfsWork.WorkRestClient);

        let settings = await workClient.getTeamSettings({ projectId: this.currentProject.id, teamId: "", project: "", team: "" });
        this.currentIterationPath = this.currentProject.name + settings.defaultIteration.path;

        let teams = await coreClient.getTeams(this.currentProject.id, true, 50);
        let team = teams[0];

        let teamContext: TfsCore.TeamContext = { projectId: this.currentProject.id, teamId: team.id, project: "", team: "" };

        let iterations = await workClient.getTeamIterations(teamContext);

        return iterations.map(it => { 
            let sufix = "";
            if (it.attributes && it.attributes.finishDate) sufix += " -> " + it.attributes.finishDate.toDateString();
            if (settings.defaultIteration.id==it.id) sufix += " (Current)";
            return { id: it.path, text: it.name+sufix }; 
        });
    }

    private async loadItems(): Promise<ITreeItem<IWorkItem>[]> {
        if (!this.currentProject) return [];
        
        try {
            const client = getClient(TfsWIT.WorkItemTrackingRestClient);

            let iter: string;
            if (this.currentIterationPath)
                iter = "'"+this.currentIterationPath+"'";
            else
                iter = "@CurrentIteration";
    
            let topWiql = {
                query: "SELECT * FROM WorkItemLinks WHERE [Link Type] = 'Child' AND [Target].[Iteration Path]="+iter+
                            " AND [Target].[System.WorkItemType]='Task'"+
                            " AND [Target].[System.State] IN ('Ready', 'Active')"
            };
            let topRels = await client.queryByWiql(topWiql, this.currentProject.id);
            if (!topRels) return [];

            let topItems = topRels.workItemRelations.filter(item => !item.rel).map(item => item.target.id);

            let childrenWiql = {
                query: "SELECT * FROM WorkItemLinks WHERE [Link Type] = 'Child' AND [Source].[Id] IN ("+topItems.join(",")+")"
            };
            let childrenRels = await client.queryByWiql(childrenWiql, this.currentProject.id);
            let childrenItems = childrenRels.workItemRelations.filter(item => item.rel).map(item => item.target.id);
            
            let items = await client.getWorkItems(topItems.concat(childrenItems), this.currentProject.id);

            let roots = items
                .filter(it => it.fields["System.WorkItemType"]!="Task")
                .map(it => ({
                    childItems: this.getTreeChildren(it, items, childrenRels.workItemRelations),
                    data: this.getTreeItem(it),
                    expanded: true
                }));

            return roots;
        }
        catch (e) {
            return [];
        }
    }

    private static TypesMap: IIconPropsMap = {
        "": { iconName: "SkypeCircleCheck" },
        "Feature": { iconName: "Trophy2Solid", style: { color: "#773B93"} },
        "Bug": { iconName: "LadybugSolid", style: { color: "#CC293D"} }, 
        "Task": { iconName: "TaskSolid", style: { color: "#F2CB1D"} },
        "User Story": { iconName: "ReadingModeSolid", style: { color: "#009CCC"} }
    };

    private static StatesMap: IIconPropsMap = {
        "": { iconName: "StatusCircleInner", style: { color: "#000000"} },
        "New": { iconName: "StatusCircleInner", style: { color: "#b2b2b2"} },
        "Active": { iconName: "StatusCircleInner", style: { color: "#007acc"} },
        "Ready": { iconName: "StatusCircleInner", style: { color: "#007acc"} },
        "Completed": { iconName: "StatusCircleInner", style: { color: "#5688e0"} },
        "Resolved": { iconName: "StatusCircleInner", style: { color: "#5688e0"} },
        "Closed": { iconName: "StatusCircleInner", style: { color: "#339933"} },
        "Removed": { iconName: "StatusCircleRing", style: { color: "#b2b2b2"} },
    };

    private getTreeItem(it: TfsWIT.WorkItem): IWorkItem {
        let assigned = it.fields["System.AssignedTo"];

        let typeName = it.fields["System.WorkItemType"] as string;
        let typeIcon = TodoListTab.TypesMap[typeName] || TodoListTab.TypesMap[""];

        let state = it.fields["System.State"] as string;
        let stateIcon = TodoListTab.StatesMap[state] || TodoListTab.StatesMap[""];
        
        return {
            id: it.id.toString(),
            title: { 
                text: it.fields["System.Title"] as string,
                iconProps: typeIcon
            },
            state: {
                text: state,
                iconProps: stateIcon
            },
            assignedTo: (assigned ? assigned.displayName : "") as string,
            teamProject: it.fields["System.TeamProject"] as string
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
                expanded: true
            }));

        return children;
    }

    private updateIterationIndex(): void {
        let idx = this.state.iterations.findIndex(it => it.id==this.currentIterationPath);
        if (idx>=0) this.iterationSelection.select(idx);
    }

    private async reloadItems(): Promise<void> {
        this.setState({
            workItems: new TreeItemProvider<IWorkItem>(await this.loadItems())
        });
    }

    private columns = [
        {
            id: "title",
            name: "Title",
            renderCell: renderExpandableTreeCell,
            width: 400
        },{
            id: "state",
            name: "State",
            renderCell: renderTreeCell,
            width: 100
        },{
            id: "assignedTo",
            name: "Assigned To",
            renderCell: renderTreeCell,
            width: 200
        },{
            id: "teamProject",
            name: "Team Project",
            renderCell: renderTreeCell,
            width: 200
        }
    ];

    private iterationSelection = new DropdownSelection();
    
    private iterationSelect = (event: React.SyntheticEvent<HTMLElement>, item: IListBoxItem<IIterationItem>) => {
        this.currentIterationPath = item.id;
        this.updateIterationIndex();
        this.reloadItems();
    };

    private async openWorkItemClick(id: string) {
        const navSvc = await SDK.getService<TfsWIT.IWorkItemFormNavigationService>(TfsWIT.WorkItemTrackingServiceIds.WorkItemFormNavigationService);
        navSvc.openWorkItem(parseInt(id));
    };
    
    public render(): JSX.Element {
        return (
            <div className="page-content page-content-top flex-column rhythm-vertical-16">
                <span>
                    Iteration: 
                    <Dropdown
                        placeholder="Select an Iteration"
                        items={this.state.iterations}
                        onSelect={this.iterationSelect}
                        selection={this.iterationSelection}
                        width={400}
                    />
                </span>
                <Card className="flex-grow bolt-table-card" contentProps={{ contentPadding: false }}>

                    <Tree<IWorkItem>
                        columns={this.columns}
                        itemProvider={this.state.workItems}
                        onToggle={(event, treeItem: ITreeItemEx<IWorkItem>) => {
                            this.state.workItems.toggle(treeItem.underlyingItem);
                        }}
                        onSelect={(event, item) => this.openWorkItemClick(item.data.underlyingItem.data.id)}
                        scrollable={true}
                    />

                </Card>
            </div>
        );
    }
}