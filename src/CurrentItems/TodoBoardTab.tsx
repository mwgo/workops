import * as React from "react";
import * as SDK from "azure-devops-extension-sdk";

import { ObservableValue } from "azure-devops-ui/Core/Observable";
import { ISimpleListCell } from "azure-devops-ui/List";
import { ArrayItemProvider } from "azure-devops-ui/Utilities/Provider";

import { Card } from "azure-devops-ui/Card";
import { Table } from "azure-devops-ui/Table";
import {
    ColumnFill,
    ISimpleTableCell,
    renderSimpleCell,
    TableColumnLayout
} from "azure-devops-ui/Table";

export interface ITodoBoardTabState {
}

interface ITableItem extends ISimpleTableCell {
    name: ISimpleListCell;
    age: number;
    gender: string;
}

export class TodoBoardTab extends React.Component<{}, ITodoBoardTabState> {

    constructor(props: {}) {
        super(props);

        this.state = {
        };
    }

    public componentDidMount() {
        this.initializeState();
    }

    private async initializeState(): Promise<void> {
        await SDK.ready();
    }

    private columns = [
        {
            columnLayout: TableColumnLayout.singleLinePrefix,
            id: "name",
            name: "Name",
            readonly: true,
            renderCell: renderSimpleCell,
            width: new ObservableValue(200)
        },
        {
            id: "age",
            name: "Age",
            readonly: true,
            renderCell: renderSimpleCell,
            width: new ObservableValue(100)
        },
        {
            columnLayout: TableColumnLayout.none,
            id: "gender",
            name: "Gender",
            readonly: true,
            renderCell: renderSimpleCell,
            width: new ObservableValue(100)
        },
        ColumnFill
    ];
    
    private rawTableItems: ITableItem[] = [
        {
            age: 50,
            gender: "M",
            name: { /*iconProps: { render: renderStatus },*/ text: "Rory Boisvert" }
        },
        {
            age: 49,
            gender: "F",
            name: { iconProps: { iconName: "Home", ariaLabel: "Home" }, text: "Sharon Monroe" }
        },
        {
            age: 18,
            gender: "F",
            name: { iconProps: { iconName: "Home", ariaLabel: "Home" }, text: "Lucy Booth" }
        }
    ];
    
    private sampleData = new ArrayItemProvider<ITableItem>(
        this.rawTableItems.map((item: ITableItem) => {
            const newItem = Object.assign({}, item);
            newItem.name = { text: newItem.name.text };
            return newItem;
        })
    );

    public render(): JSX.Element {
        return (
            <div className="page-content page-content-top flex-column rhythm-vertical-16">
                <Card className="flex-grow bolt-table-card" contentProps={{ contentPadding: false }}>
                    <Table columns={this.columns} itemProvider={this.sampleData} role="table" />
                </Card>
            </div>
        );
    }
}