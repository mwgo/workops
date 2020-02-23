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
import * as Work from "azure-devops-extension-api/Work/Work";

import * as UiCore from "azure-devops-ui/Core/Observable";
import { ArrayItemProvider } from "azure-devops-ui/Utilities/Provider";

import { Card } from "azure-devops-ui/Card";
import {
    Table,
    ISimpleTableCell,
    TableColumnLayout,
    renderSimpleCell,
    ColumnFill
} from "azure-devops-ui/Table";
import { Dropdown } from "azure-devops-ui/Dropdown";
import { DropdownSelection } from "azure-devops-ui/Utilities/DropdownSelection";
import { IListBoxItem } from "azure-devops-ui/ListBox";

interface ITableItem extends ISimpleTableCell {
    id: string;
    title: string;
    state: string;
    assignedTo: string;
}

interface IIterationItem {
    id: string;
    text: string;
}

export interface ITodoListTabState {
    workItems: ArrayItemProvider<ITableItem>;
    iterations: IListBoxItem<IIterationItem>[];
}

export class TodoListTab extends React.Component<{}, ITodoListTabState> {

    private currentProject?: IProjectInfo;
    private currentIterationPath: string = "";

    constructor(props: {}) {
        super(props);

        this.state = {
            iterations: [],
            workItems: new ArrayItemProvider<ITableItem>([])
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
            workItems: new ArrayItemProvider<ITableItem>(await this.loadItems())
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

    private async loadItems(): Promise<ITableItem[]> {
        if (!this.currentProject) return [];
        
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
        try {
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
                // .filter(it => it.fields["System.WorkItemType"]!="Task")
                .map(it => {
                    let assigned = it.fields["System.AssignedTo"];
                    return {
                        id: it.id.toString(),
                        title: it.fields["System.Title"] as string,
                        state: it.fields["System.State"] as string,
                        assignedTo: (assigned ? assigned.displayName : "") as string,
                    };
                });

            return roots;
        }
        catch (e) {
            return [];
        }
    }

    private updateIterationIndex(): void {
        let idx = this.state.iterations.findIndex(it => it.id==this.currentIterationPath);
        if (idx>=0) this.iterationSelection.select(idx);
    }

    private async reloadItems(): Promise<void> {
        this.setState({
            workItems: new ArrayItemProvider<ITableItem>(await this.loadItems())
        });
    }

    private async loadSample() {
        const navService = await SDK.getService<IProjectPageService>(CommonServiceIds.ProjectPageService);
        const proj = await navService.getProject();
        if (!proj) return;

        let client = getClient(TfsWIT.WorkItemTrackingRestClient);
        let coreClient = getClient(TfsCore.CoreRestClient);
        let workClient = getClient(TfsWork.WorkRestClient);

        let settings = await workClient.getTeamSettings({ projectId: proj.id, teamId: "", project: "", team: "" });
        var iteration = settings.defaultIteration;
        
        let teams = await coreClient.getTeams(proj.id, true, 50);
        let team = teams[0];

        let teamContext: TfsCore.TeamContext = { projectId: proj.id, teamId: team.id, project: "", team: "" };

        let iterations = await workClient.getTeamIterations(teamContext);
    }

    private columns = [
        {
            columnLayout: TableColumnLayout.singleLinePrefix,
            id: "id",
            name: "ID",
            readonly: true,
            renderCell: renderSimpleCell,
            width: new UiCore.ObservableValue(70)
        },
        {
            id: "title",
            name: "Title",
            readonly: true,
            renderCell: renderSimpleCell,
            width: new UiCore.ObservableValue(400)
        },
        {
            id: "state",
            name: "State",
            readonly: true,
            renderCell: renderSimpleCell,
            width: new UiCore.ObservableValue(100)
        },
        {
            id: "assignedTo",
            name: "Assigned To",
            readonly: true,
            renderCell: renderSimpleCell,
            width: new UiCore.ObservableValue(300)
        },
        ColumnFill
    ];

    private iterationSelection = new DropdownSelection();
    
    private iterationSelect = (event: React.SyntheticEvent<HTMLElement>, item: IListBoxItem<IIterationItem>) => {
        this.currentIterationPath = item.id;
        this.updateIterationIndex();
        this.reloadItems();
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
                    <Table columns={this.columns} itemProvider={this.state.workItems} role="table" />
                </Card>
            </div>
        );
    }
}