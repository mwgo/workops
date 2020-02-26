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
import * as TfsClient from "azure-devops-extension-api/Work/WorkClient";
import * as TfsWork from "azure-devops-extension-api/Work";

import { Card } from "azure-devops-ui/Card";
import { ISimpleTableCell } from "azure-devops-ui/Table";
import { ISimpleListCell } from "azure-devops-ui/List";

import { Tree } from "azure-devops-ui/TreeEx";
import { ITreeItem, ITreeItemEx, TreeItemProvider } from "azure-devops-ui/Utilities/TreeItemProvider";
import { renderExpandableTreeCell, renderTreeCell } from "azure-devops-ui/TreeEx";

import { FilterBar } from "azure-devops-ui/FilterBar";
import { KeywordFilterBarItem } from "azure-devops-ui/TextFilterBarItem";
import { DropdownFilterBarItem } from "azure-devops-ui/Dropdown";
import { Filter, FILTER_CHANGE_EVENT } from "azure-devops-ui/Utilities/Filter";

import { DropdownSelection } from "azure-devops-ui/Utilities/DropdownSelection";
import { IListBoxItem } from "azure-devops-ui/ListBox";
import { IIconProps } from "azure-devops-ui/Icon";

interface IWorkItem extends ISimpleTableCell {
    id: string;
    title: ISimpleListCell;
    state: ISimpleListCell;
    assignedTo: string;
    area: string;
    priority: number;
}

interface IIterationItem {
    id: string;
    text: string;
}

interface ITodoListTabState {
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

    private filter: Filter;
    private iterationList = new DropdownSelection();

    private currentProject?: IProjectInfo;
    private currentIterationPath: string = "";

    constructor(props: {}) {
        super(props);

        this.filter = new Filter();
        this.filter.subscribe(() => this.filterChanged(), FILTER_CHANGE_EVENT);

        this.state = {
            iterations: [],
            workItems: new TreeItemProvider<IWorkItem>([])
        };
    }

    public componentDidMount() {
        this.initializeState();
    }

    private filterChanged(): void {
        let idx = this.iterationList.value[0].beginIndex;
        if (this.state.iterations[idx].id!=this.currentIterationPath) {
            this.currentIterationPath = this.state.iterations[idx].id;
            this.updateIterationIndex();
            this.reloadItems();
        }
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
        let workClient = getClient(TfsClient.WorkRestClient);

        let projectId = this.currentProject.id;
        let teams = await coreClient.getTeams(this.currentProject.id, true, 50);
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

        let iter = iterations.first(i => TodoListTab.isCurrentIteration(i));
        this.currentIterationPath = iter ? iter.path : "";

        return iterations.map(it => { 
            let sufix = "";
            if (this.currentIterationPath==it.path) sufix += " (Current)";
            return { 
                id: it.path, 
                text: it.name+sufix,
                iconProps: { iconName: "Sprint" }
            }; 
        });
    }

    private static isCurrentIteration(iter: TfsWork.TeamSettingsIteration): boolean {
        let dt = Date.now();
        return (!iter.attributes.startDate || iter.attributes.startDate.getTime()<=dt) 
            && (!iter.attributes.finishDate || dt<=iter.attributes.finishDate.getTime());
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
                query: "SELECT * FROM WorkItemLinks WHERE [Link Type] = 'Child'"+
                            " AND [Target].[System.AssignedTo]=@me"+
                            " AND [Target].[Iteration Path]="+iter+
                            " AND [Target].[System.WorkItemType]='Task'"+
                            " AND [Target].[System.State] IN ('Ready', 'Active')"
            };
            let topWiql2 = {
                query: "SELECT * FROM WorkItems WHERE [System.AssignedTo]=@me"+
                            " AND [Iteration Path]="+iter+
                            " AND [System.WorkItemType] IN ('Bug', 'User Story')"+
                            " AND [System.State] IN ('Ready', 'Active')"
            };

            let top = await Promise.all([
                client.queryByWiql(topWiql, this.currentProject.id),
                client.queryByWiql(topWiql2, this.currentProject.id)
            ]);

            if (!top[0] || !top[1]) return [];

            let topItems = top[0].workItemRelations.filter(item => !item.rel).map(item => item.target.id);
            topItems = topItems.concat(top[1].workItems.map(item => item.id));
            if (topItems.length==0) return [];

            let childrenWiql = {
                query: "SELECT * FROM WorkItemLinks WHERE [Link Type] = 'Child' AND [Source].[Id] IN ("+topItems.join(",")+")"
            };
            let childrenRels = await client.queryByWiql(childrenWiql, this.currentProject.id);
            let childrenItems = childrenRels.workItemRelations.filter(item => item.rel).map(item => item.target.id);
            
            let items = await client.getWorkItems(topItems.concat(childrenItems), this.currentProject.id);

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

    private updateIterationIndex(): void {
        let idx = this.state.iterations.findIndex(it => it.id==this.currentIterationPath);
        if (idx>=0) this.iterationList.select(idx);
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
            id: "area",
            name: "Area",
            renderCell: renderTreeCell,
            width: 200
        }
    ];

    private async openWorkItemClick(id: string) {
        const navSvc = await SDK.getService<TfsWIT.IWorkItemFormNavigationService>(TfsWIT.WorkItemTrackingServiceIds.WorkItemFormNavigationService);
        navSvc.openWorkItem(parseInt(id));
    };

    public render(): JSX.Element {
        return (
            <div className="page-content page-content-top flex-column rhythm-vertical-16">
                <FilterBar filter={this.filter}>

                    <KeywordFilterBarItem filterItemKey="Placeholder" />

                    <DropdownFilterBarItem
                        filterItemKey="iterationList"
                        filter={this.filter}
                        items={this.state.iterations}
                        selection={this.iterationList}
                        placeholder="Iteration"
                        showPlaceholderAsLabel={false}
                        hideClearAction={true}
                    />

                </FilterBar>

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