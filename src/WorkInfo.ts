import React = require("react");

import * as TfsGit from "azure-devops-extension-api/Git";
import * as TfsWIT from "azure-devops-extension-api/WorkItemTracking";

import { ITreeItem, TreeItemProvider } from "azure-devops-ui/Utilities/TreeItemProvider";

import { Styles } from "./Styles";
import { LinkItem } from "./LinkItem";
import { Data, IWorkItem } from "./Data";
import { CommentType } from "azure-devops-extension-api/Git";
import { IIconProps } from "azure-devops-ui/Icon";

export enum PrStatus {
    Waiting,
    Ready,
    Done,
    Other
}

export class WorkInfo {
    readonly Data: Data;
    readonly ID: number;
    readonly Item: TfsWIT.WorkItem;
    readonly Comments?: TfsWIT.WorkItemComments;

    readonly State: string;
    readonly IsActive: boolean;
    readonly IsMy: boolean;
    readonly IsMentioned: boolean;

    constructor(data: Data, it: TfsWIT.WorkItem, comments?: TfsWIT.WorkItemComments) {
        this.Data = data;
        this.ID = it.id;
        this.Item = it;
        this.Comments = comments;

        this.State = this.Item.fields["System.State"] as string;

        let assigned = this.Item.fields["System.AssignedTo"];
        this.IsMy = data.Settings.IsCurrentUserRef(assigned);
        this.IsActive = this.State=="Active" || this.State=="Ready";
        this.IsMentioned = false;

        if (comments) {
            this.IsMentioned = this.IsMy;
            for (const comment of comments.comments) {
                if (data.Settings.ContainsCurrentUser2(comment.text)) this.IsMentioned = true;
                if (this.IsMy && comment.text.indexOf("data-vss-mention=")<0) this.IsMentioned = true;
                if (data.Settings.IsCurrentUserRef(comment.revisedBy)) this.IsMentioned = false;
            }    
        }
    }

    public static async create(data: Data, client: TfsWIT.WorkItemTrackingRestClient, ids: number[], withComment: boolean=false) {
        let witems = await client.getWorkItems(ids, data.Settings.CurrentProject.id, 
            undefined, undefined,
            TfsWIT.WorkItemExpand.Relations);

        if (witems.length==0) return [];

        let comments: TfsWIT.WorkItemComments[] = [];
        if (withComment)
            comments = await Promise.all(witems.map(it => client.getComments(it.id, data.Settings.CurrentProject.id)));

        return witems.map((wit, idx) => new WorkInfo(data, wit, comments==null ? undefined : comments[idx]));
    }

    public getTreeChildren(): ITreeItem<IWorkItem>[] | undefined {
        if (this.Item.fields["System.WorkItemType"]=="Task") return undefined;

        let children = this.getChildrenItems()
            .map(info => ({
                childItems: info ? info.getTreeChildren() : [],
                data: info.getTreeItem(),
                expanded: false
            }));

        return children;
    }

    public getChildrenItems(): WorkInfo[] {
        let result = this.Data.AllLinks
            .filter(l => l.source && l.target && l.source.id==this.ID)
            .map(l => this.Data.AllItems.first(info => info.ID==l.target.id));
        return result;
    }
            
    public getRelations(): { type: string, link: string }[] {
        let t: { type: string, link: string }[] = [];
        for (let r of this.Item.relations.filter(r => r.rel=="ArtifactLink")) {
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

    public getTreeItem(): IWorkItem {
        let assigned = this.Item.fields["System.AssignedTo"];

        let typeName = this.Item.fields["System.WorkItemType"] as string;
        let typeIcon = Styles.TypesMap[typeName] || Styles.TypesMap[""];

        let stateIcon = Styles.StatesMap[this.State] || Styles.StatesMap[""];

        let release = this.Item.fields["Custom.Release"] as string;
        if (!release) release = this.Item.fields["Custom.319d7677-7313-48ce-858e-746a615b8704"] as string;

        let n = 0;
        let rels : React.ReactNode[] = this
            .getRelations()
            .map(r => React.createElement(LinkItem, { 
                Data: this.Data, 
                Link: r.type + r.link, 
                ID: this.ID, 
                Icon: Styles.LinksIcon[r.type], 
                key: this.ID + r.type + (n++)
            }));

        let textNode: React.ReactNode = this.Item.fields["System.Title"] as string;
        if (this.IsMy)
            textNode = React.createElement("span", null,
                React.createElement("span", { className: "currentlist-my-id" },
                    this.ID+": "
                ),
                textNode
            );
        else
            textNode = this.ID + ": " + textNode;

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

        let result: IWorkItem = {
            // workItem: it,
            id: "item"+this.ID,
            title: { 
                text: this.ID + ": " + this.Item.fields["System.Title"] as string,
                textNode: textNode,
                iconProps: typeIcon,
                textClassName: this.IsActive ? "currentlist-active-text" : ""
            },
            state: {
                text: this.State,
                iconProps: stateIcon
            },
            assignedTo: (assigned ? assigned.displayName : "") as string,
            area: this.Item.fields["System.AreaPath"] as string,
            priority: this.Item.fields["Microsoft.VSTS.Common.Priority"] as number,
            release: release
        };

        return result;
    }

    public getRecursiveItems(): WorkInfo[] {
        let t: WorkInfo[] = [this];

        let scan = (info: WorkInfo) => {
            let r = info.getChildrenItems();
            t = t.concat(r);
            r.forEach(scan);
        }
        scan(this);

        return t;
    }
}

