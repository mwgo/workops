import * as React from "react";
import * as SDK from "azure-devops-extension-sdk";
import * as TfsWIT from "azure-devops-extension-api/WorkItemTracking";

import { Card } from "azure-devops-ui/Card";
import { Tree } from "azure-devops-ui/TreeEx";
import { renderExpandableTreeCell, renderTreeCell } from "azure-devops-ui/TreeEx";

import { FilterBar } from "azure-devops-ui/FilterBar";
import { KeywordFilterBarItem } from "azure-devops-ui/TextFilterBarItem";
import { DropdownFilterBarItem } from "azure-devops-ui/Dropdown";
import { Filter, FILTER_CHANGE_EVENT } from "azure-devops-ui/Utilities/Filter";

import { DropdownSelection } from "azure-devops-ui/Utilities/DropdownSelection";

import {
    IWorkItem,
    Data,
} from "../Data"

interface ITodoListTabState {
    version: number;
}

export class TodoListTab extends React.Component<{}, ITodoListTabState> {
    
    private data = new Data();
    private filter: Filter;
    private iterationList = new DropdownSelection();
    private tasksFilter = new DropdownSelection();

    constructor(props: {}) {
        super(props);

        this.filter = new Filter();
        this.filter.subscribe(() => this.filterChanged(), FILTER_CHANGE_EVENT);

        this.state = {
            version: 0
        };
    }

    public async componentDidMount() {
        await this.data.initialize();

        this.setState({ version: this.state.version+1 });

        this.updateIterationIndex();
        this.updateTaskFilter();
    }

    private async filterChanged() {
        let changed = false;

        let idx = this.iterationList.value[0].beginIndex;
        if (this.data.Iterations[idx].id!=this.data.CurrentIterationPath) {
            this.data.CurrentIterationPath = this.data.Iterations[idx].id;
            this.updateIterationIndex();
            changed = true;
        }

        let tf = this.tasksFilter.value.length==0 ? 0 : this.tasksFilter.value[0].beginIndex;
        if (this.data.TaskFilter!=Data.TaskFilterValaues[tf]) {
            this.data.TaskFilter = Data.TaskFilterValaues[tf];
            this.updateTaskFilter();
            changed = true;
        }

        if (changed) {
            await this.data.reloadItems();
            this.setState({ version: this.state.version+1 });
        }
    }

    private updateIterationIndex(): void {
        let idx = this.data.Iterations.findIndex(it => it.id==this.data.CurrentIterationPath);
        if (idx>=0) this.iterationList.select(idx);
    }

    private updateTaskFilter(): void {
        let idx = Data.TaskFilterValaues.findIndex(it => it==this.data.TaskFilter);
        if (idx>=0) this.tasksFilter.select(idx);
    }

    private async openWorkItemClick(id: string) {
        const navSvc = await SDK.getService<TfsWIT.IWorkItemFormNavigationService>(TfsWIT.WorkItemTrackingServiceIds.WorkItemFormNavigationService);
        navSvc.openWorkItem(parseInt(id));
    };

    private columns = [
        {
            id: "title",
            name: "Title",
            renderCell: renderExpandableTreeCell,
            width: 700
        },{
            id: "state",
            name: "State",
            renderCell: renderTreeCell,
            width: 100
        },{
            id: "assignedTo",
            name: "Assigned To",
            renderCell: renderTreeCell,
            width: 140
        },{
            id: "release",
            name: "Version",
            renderCell: renderTreeCell,
            width: 100
        }
    ];

    public render(): JSX.Element {
        return (
            <div className="page-content page-content-top flex-column rhythm-vertical-16">
                <FilterBar 
                    filter={this.filter} 
                    hideClearAction={true}>

                    <KeywordFilterBarItem filterItemKey="Placeholder" />

                    <DropdownFilterBarItem
                        filterItemKey="tasksFilter"
                        filter={this.filter}
                        items={Data.TaskFilterValaues}
                        selection={this.tasksFilter}
                        placeholder="Tasks"
                        showPlaceholderAsLabel={false}
                        hideClearAction={true}
                    />

                    <DropdownFilterBarItem
                        filterItemKey="iterationList"
                        filter={this.filter}
                        items={this.data.Iterations}
                        selection={this.iterationList}
                        placeholder="Iteration"
                        showPlaceholderAsLabel={false}
                        hideClearAction={true}
                    />

                </FilterBar>

                <Card className="flex-grow bolt-table-card" contentProps={{ contentPadding: false }}>

                    <Tree<IWorkItem>
                        itemProvider={this.data.WorkItemsProvider}
                        columns={this.columns}
                        onToggle={(event, treeItem) => {
                            this.data.WorkItemsProvider.toggle(treeItem.underlyingItem);
                        }}
                        onSelect={(event, item) => {
                            this.openWorkItemClick(item.data.underlyingItem.data.id);
                            event.preventDefault();
                        }}
                        scrollable={true}
                    />

                </Card>
            </div>
        );
    }
}