import * as React from "react";
import * as SDK from "azure-devops-extension-sdk";
import { getClient } from "azure-devops-extension-api";
import { CoreRestClient, ProjectVisibility, TeamProjectReference } from "azure-devops-extension-api/Core";

import { ObservableValue } from "azure-devops-ui/Core/Observable";
// import { ISimpleListCell } from "azure-devops-ui/List";
import { ArrayItemProvider } from "azure-devops-ui/Utilities/Provider";

import { Card } from "azure-devops-ui/Card";
import { Table } from "azure-devops-ui/Table";
import {
    ColumnFill,
    ISimpleTableCell,
    renderSimpleCell,
    TableColumnLayout
} from "azure-devops-ui/Table";

interface ITableItem extends ISimpleTableCell {
    id: string;
    name: string;
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
        let projects = await getClient(CoreRestClient).getProjects();

        let data = new ArrayItemProvider<ITableItem>(
            projects.map((item: TeamProjectReference) => {
                return {
                    id: item.id,
                    name: item.name
                };
            })
        );

        this.setState({
            projects: data
        });
    }

    private columns = [
        {
            columnLayout: TableColumnLayout.singleLinePrefix,
            id: "id",
            name: "id",
            readonly: true,
            renderCell: renderSimpleCell,
            width: new ObservableValue(200)
        },
        {
            id: "name",
            name: "name",
            readonly: true,
            renderCell: renderSimpleCell,
            width: new ObservableValue(300)
        },
        ColumnFill
    ];
    
    public render(): JSX.Element {
        return (
            <div className="page-content page-content-top flex-column rhythm-vertical-16">
                <Card className="flex-grow bolt-table-card" contentProps={{ contentPadding: false }}>
                    <Table columns={this.columns} itemProvider={this.state.projects} role="table" />
                </Card>
            </div>
        );
    }
}