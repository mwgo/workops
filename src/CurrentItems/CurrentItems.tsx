import "./CurrentItems.scss";

import "es6-promise/auto";
import * as React from "react";
import * as SDK from "azure-devops-extension-sdk";
import { CommonServiceIds, IHostPageLayoutService } from "azure-devops-extension-api";
import { ObservableValue } from "azure-devops-ui/Core/Observable";
import { ISimpleListCell } from "azure-devops-ui/List";
import { ArrayItemProvider } from "azure-devops-ui/Utilities/Provider";

import { Table } from "azure-devops-ui/Table";
import {
    ColumnFill,
    ISimpleTableCell,
    renderSimpleCell,
    TableColumnLayout
} from "azure-devops-ui/Table";
import { Card } from "azure-devops-ui/Card";

import { Header, TitleSize } from "azure-devops-ui/Header";
import { IHeaderCommandBarItem } from "azure-devops-ui/HeaderCommandBar";
import { Page } from "azure-devops-ui/Page";

import { showRootComponent } from "../Common";

interface ICurrentItemsHubState {
    fullScreenMode: boolean;
    useCompactPivots?: boolean;
}

interface ITableItem extends ISimpleTableCell {
    name: ISimpleListCell;
    age: number;
    gender: string;
}

class CurrentItemsHub extends React.Component<{}, ICurrentItemsHubState> {

    constructor(props: {}) {
        super(props);

        this.state = {
            fullScreenMode: false
        };
    }

    public componentDidMount() {
        SDK.init();
        this.initializeFullScreenState();
    }

    public render(): JSX.Element {

        return (
            <Page className="sample-hub flex-grow">
                <Header title="Current Work-Items"
                    commandBarItems={this.getCommandBarItems()}
                    titleSize={TitleSize.Medium} />

                <div className="page-content page-content-top flex-column rhythm-vertical-16">
                    <Card className="flex-grow bolt-table-card" contentProps={{ contentPadding: false }}>
                        <Table columns={this.columns} itemProvider={this.sampleData} role="table" />
                    </Card>
                </div>
            </Page>
        );
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
    
    
    
    
    
    private getCommandBarItems(): IHeaderCommandBarItem[] {
        return [
            {
              id: "panel",
              text: "Panel",
              onActivate: () => { this.onPanelClick() },
              iconProps: {
                iconName: 'Add'
              },
              isPrimary: true,
              tooltipProps: {
                text: "Open a panel with custom extension content"
              }
            },
            {
              id: "messageDialog",
              text: "Message",
              onActivate: () => { this.onMessagePromptClick() },
              tooltipProps: {
                text: "Open a simple message dialog"
              }
            },
            {
                id: "fullScreen",
                ariaLabel: this.state.fullScreenMode ? "Exit full screen mode" : "Enter full screen mode",
                iconProps: {
                    iconName: this.state.fullScreenMode ? "BackToWindow" : "FullScreen"
                },
                onActivate: () => { this.onToggleFullScreenMode() }
            },
            {
              id: "customDialog",
              text: "Custom Dialog",
              onActivate: () => { this.onCustomPromptClick() },
              tooltipProps: {
                text: "Open a dialog with custom extension content"
              }
            }
        ];
    }

    private async onMessagePromptClick(): Promise<void> {
        const dialogService = await SDK.getService<IHostPageLayoutService>(CommonServiceIds.HostPageLayoutService);
        dialogService.openMessageDialog("Use large title?", {
            showCancel: true,
            title: "Message dialog",
            onClose: (result) => {
            }
        });
    }

    private async onCustomPromptClick(): Promise<void> {
        const dialogService = await SDK.getService<IHostPageLayoutService>(CommonServiceIds.HostPageLayoutService);
        dialogService.openCustomDialog<boolean | undefined>(SDK.getExtensionContext().id + ".panel-content", {
            title: "Custom dialog",
            configuration: {
                message: "Use compact pivots?",
                initialValue: this.state.useCompactPivots
            },
            onClose: (result) => {
                if (result !== undefined) {
                    this.setState({ useCompactPivots: result });
                }
            }
        });
    }

    private async onPanelClick(): Promise<void> {
        const panelService = await SDK.getService<IHostPageLayoutService>(CommonServiceIds.HostPageLayoutService);
        panelService.openPanel<boolean | undefined>(SDK.getExtensionContext().id + ".panel-content", {
            title: "My Panel",
            description: "Description of my panel",
            configuration: {
                message: "Show header description?"
            },
            onClose: (result) => {
            }
        });
    }

    private async initializeFullScreenState() {
        const layoutService = await SDK.getService<IHostPageLayoutService>(CommonServiceIds.HostPageLayoutService);
        const fullScreenMode = await layoutService.getFullScreenMode();
        if (fullScreenMode !== this.state.fullScreenMode) {
            this.setState({ fullScreenMode });
        }
    }

    private async onToggleFullScreenMode(): Promise<void> {
        const fullScreenMode = !this.state.fullScreenMode;
        this.setState({ fullScreenMode });

        const layoutService = await SDK.getService<IHostPageLayoutService>(CommonServiceIds.HostPageLayoutService);
        layoutService.setFullScreenMode(fullScreenMode);
    }
}

showRootComponent(<CurrentItemsHub />);
