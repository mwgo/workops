import * as React from "react";
import * as SDK from "azure-devops-extension-sdk";

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
    TaskFilters
} from "../Data";

interface ITodoListTabState {
    version: number;
}

interface ITodoListTabProps {
    data: Data;
}

export class TodoListTab extends React.Component<ITodoListTabProps, ITodoListTabState> {
    
    private filter: Filter;
    private iterationList = new DropdownSelection();
    private tasksFilter = new DropdownSelection();
    private userFilter = new DropdownSelection();

    constructor(props: ITodoListTabProps) {
        super(props);

        this.filter = new Filter();
        this.filter.subscribe(() => this.filterChanged(), FILTER_CHANGE_EVENT);

        this.state = { version: 0 };
    }

    get data(): Data {
        return this.props.data;
    }

    public async componentDidMount() {
        await SDK.ready();

        this.props.data.OnRefreshing = () => {
            this.updateIterationIndex();
            this.setState({ version: this.state.version+1 });
        };

        this.props.data.OnUsersChanged = () => {
            // this.updateUserFilter();
            // this.setState({ version: this.state.version+1 });
        };

        await this.data.refresh();

        this.updateIterationIndex();
        this.updateTaskFilter();
        this.updateUserFilter();
    }

    private async filterChanged() {
        let changed = false;

        if (this.iterationList.value.length>0) {
            let idx = this.iterationList.value[0].beginIndex;
            if (this.data.Settings.Iterations[idx].id!=this.data.Settings.CurrentIterationPath) {
                this.data.Settings.CurrentIterationPath = this.data.Settings.Iterations[idx].id;
                this.updateIterationIndex();
                changed = true;
            }
        }

        if (this.tasksFilter.value.length>0) {
            let tf = this.tasksFilter.value[0].beginIndex;
            if (this.data.TaskFilter!=Data.TaskFilterValues[tf]) {
                this.data.TaskFilter = Data.TaskFilterValues[tf] as TaskFilters;
                this.updateTaskFilter();
                changed = true;
            }
        }

        if (this.userFilter.value.length>0) {
            let uf = this.userFilter.value[0].beginIndex;
            if (this.data.UserFilter!=this.data.UserFilterValues[uf]) {
                this.data.UserFilter = this.data.UserFilterValues[uf];
                this.updateUserFilter();
                changed = true;
            }
        }

        if (changed) this.data.refresh();
    }

    private updateIterationIndex(): void {
        let idx = this.data.Settings.Iterations.findIndex(it => it.id==this.data.Settings.CurrentIterationPath);
        if (idx>=0) this.iterationList.select(idx);
    }

    private updateTaskFilter(): void {
        let idx = Data.TaskFilterValues.findIndex(it => it==this.data.TaskFilter);
        if (idx>=0) this.tasksFilter.select(idx);
    }

    private updateUserFilter(): void {
        let idx = this.data.UserFilterValues.findIndex(it => it==this.data.UserFilter);
        if (idx>=0) this.userFilter.select(idx);
    }

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
            width: 130
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

                    {/* <DropdownFilterBarItem
                        filterItemKey="userFilter"
                        filter={this.filter}
                        items={this.data.UserFilterValues}
                        selection={this.userFilter}
                        placeholder="User"
                        showPlaceholderAsLabel={false}
                        hideClearAction={true}
                    /> */}

                    <DropdownFilterBarItem
                        filterItemKey="tasksFilter"
                        filter={this.filter}
                        items={Data.TaskFilterValues}
                        selection={this.tasksFilter}
                        placeholder="Tasks"
                        showPlaceholderAsLabel={false}
                        hideClearAction={true}
                    />

                    <DropdownFilterBarItem
                        filterItemKey="iterationList"
                        filter={this.filter}
                        items={this.data.Settings.Iterations}
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
                        onToggle={(event, item) => this.data.toggle(item.underlyingItem)}
                        onSelect={(event, item) => {
                            this.data.openItem(item.data.underlyingItem.data.id);
                            event.preventDefault();
                        }}
                        scrollable={true}
                    />

                </Card>
            </div>
        );
    }
}