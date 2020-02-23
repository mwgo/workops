import * as React from "react";
import * as SDK from "azure-devops-extension-sdk";
import { 
    getClient,
    CommonServiceIds, 
    IProjectPageService
 } from "azure-devops-extension-api";
import * as TfsCore from "azure-devops-extension-api/Core";
import * as TfsWIT from "azure-devops-extension-api/WorkItemTracking";
import * as TfsWork from "azure-devops-extension-api/Work/WorkClient";

import * as UiCore from "azure-devops-ui/Core/Observable";
// import { ISimpleListCell } from "azure-devops-ui/List";
import { ArrayItemProvider } from "azure-devops-ui/Utilities/Provider";

import { Card } from "azure-devops-ui/Card";
import * as UiTable from "azure-devops-ui/Table";

interface ITableItem extends UiTable.ISimpleTableCell {
    id: string;
    title: string;
    state: string;
    assignedTo: string;
}

export interface ITodoListTabState {
    projects: ArrayItemProvider<ITableItem>;
}

export class TodoListTab extends React.Component<{}, ITodoListTabState> {

    constructor(props: {}) {
        super(props);

        this.state = {
            projects: new ArrayItemProvider<ITableItem>([])
        };
    }

    public componentDidMount() {
        this.initializeState();
    }



    private async initializeState(): Promise<void> {
        await SDK.ready();
        this.loadItems();
    }

    private async loadItems(): Promise<void> {
        const navService = await SDK.getService<IProjectPageService>(CommonServiceIds.ProjectPageService);
        const proj = await navService.getProject();
        if (!proj) return;

        let client = getClient(TfsWIT.WorkItemTrackingRestClient);

        let topWiql = {
            query: "SELECT * FROM WorkItemLinks WHERE [Link Type] = 'Child' AND [Target].[Iteration Path] = @CurrentIteration "+
                        "AND [Target].[System.WorkItemType]='Task' "+
                        "AND [Target].[System.State] IN ('Ready', 'Active')"
        };
        let topRels = await client.queryByWiql(topWiql, proj.id);
        let topItems = topRels.workItemRelations.filter(item => !item.rel).map(item => item.target.id);

        let childrenWiql = {
            query: "SELECT * FROM WorkItemLinks WHERE [Link Type] = 'Child' AND [Source].[Id] IN ("+topItems.join(",")+")"
        };
        let childrenRels = await client.queryByWiql(childrenWiql, proj.id);
        let childrenItems = childrenRels.workItemRelations.filter(item => item.rel).map(item => item.target.id);
        
        let items = await client.getWorkItems(topItems.concat(childrenItems), proj.id);

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

        this.setState({
            projects: new ArrayItemProvider<ITableItem>(roots)
        });

        // debugger;
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
            columnLayout: UiTable.TableColumnLayout.singleLinePrefix,
            id: "id",
            name: "ID",
            readonly: true,
            renderCell: UiTable.renderSimpleCell,
            width: new UiCore.ObservableValue(70)
        },
        {
            id: "title",
            name: "Title",
            readonly: true,
            renderCell: UiTable.renderSimpleCell,
            width: new UiCore.ObservableValue(400)
        },
        {
            id: "state",
            name: "State",
            readonly: true,
            renderCell: UiTable.renderSimpleCell,
            width: new UiCore.ObservableValue(100)
        },
        {
            id: "assignedTo",
            name: "Assigned To",
            readonly: true,
            renderCell: UiTable.renderSimpleCell,
            width: new UiCore.ObservableValue(300)
        },
        UiTable.ColumnFill
    ];
    
    public render(): JSX.Element {
        return (
            <div className="page-content page-content-top flex-column rhythm-vertical-16">
                <Card className="flex-grow bolt-table-card" contentProps={{ contentPadding: false }}>
                    <UiTable.Table columns={this.columns} itemProvider={this.state.projects} role="table" />
                </Card>
            </div>
        );
    }
}