import React = require("react");

import * as SDK from "azure-devops-extension-sdk";
import * as TfsWIT from "azure-devops-extension-api/WorkItemTracking";
import * as TfsGit from "azure-devops-extension-api/Git";
import { getClient } from "azure-devops-extension-api";
import { ITreeItem, TreeItemProvider } from "azure-devops-ui/Utilities/TreeItemProvider";
import { ISimpleTableCell } from "azure-devops-ui/Table";
import { ISimpleListCell } from "azure-devops-ui/List";

import { Styles } from "./Styles";
import { LinkItem } from "./LinkItem";
import { SettingsData } from "./SettingsData";
import { ToolsSetup } from "./Tools";
import { IIconProps } from "azure-devops-ui/Icon";
import { Data, IWorkItem } from "./Data";

export class PrInfo {
    readonly PR: TfsGit.GitPullRequest;
    readonly Status: string;
    readonly NComments: number;
    readonly Active: boolean;

    constructor(pr: TfsGit.GitPullRequest, threads: TfsGit.GitPullRequestCommentThread[]) {
        this.PR = pr;

        this.NComments = threads.filter(t => t.status==TfsGit.CommentThreadStatus.Active || t.status==TfsGit.CommentThreadStatus.Pending).length;
        
        this.Status = "Ready";
        if (pr.reviewers.some(r => r.vote<0)) this.Status = "Waiting";
        else if (this.NComments==1) this.Status = "Comment";
        else if (this.NComments>1) this.Status = this.NComments+" comments";
        else if (pr.reviewers.some(r => r.isRequired && r.vote==0)) this.Status = "";
        else if (pr.reviewers.some(r => !r.isRequired)) 
            if (pr.reviewers.every(r => !r.isRequired && r.vote==0)) this.Status = "";

        this.Active = !!this.Status;
    }

    createWorkItem(data: Data): IWorkItem {
        let textNode: React.ReactNode = this.PR.pullRequestId + ": " + this.PR.title;

        let url = this.PR.url;
        url = url.replace("/_apis/git/repositories/", "/_git/");
        url = url.substring(0, url.indexOf("/pullRequests/"));
        url = url+"?version=GB";

        let sourceBranch = PrInfo.prepareBranchName(this.PR.sourceRefName);
        let targetBranch = PrInfo.prepareBranchName(this.PR.targetRefName);

        data.LinksInfo[sourceBranch] = {
            name: sourceBranch,
            title: sourceBranch,
            url: url+sourceBranch.replace("/", "%2f")
        };
        data.LinksInfo[targetBranch] = {
            name: targetBranch,
            title: targetBranch,
            url: url+targetBranch.replace("/", "%2f")
        };

        let rels : React.ReactNode[] = [
            React.createElement(LinkItem, {
                Data: data, 
                Link: sourceBranch, 
                ID: -1, 
                Icon: Styles.LinkBranchIconName, 
                key: "pr_source"+this.PR.pullRequestId
            }),
            " ",
            React.createElement(LinkItem, {
                Data: data, 
                Link: targetBranch, 
                ID: -1, 
                Icon: Styles.LinkTargetBranchIconName, 
                key: "pr_target"+this.PR.pullRequestId
            })
        ];

        textNode = React.createElement("div", null,
            textNode,
            React.createElement("div", null,
                React.createElement("small", null, 
                    rels
        )));

        let status = this.Status;
        let statusIcon = status ? Styles.PrStateActive : Styles.PrStateCompleted;
        let refVote = this.PR.reviewers.find(rv => data.Settings.CurrentUser!==undefined && rv.uniqueName==data.Settings.CurrentUser.name);
        if (refVote) {
            switch (refVote.vote) {
                case 10:
                    status = "approved";
                    statusIcon = Styles.PrStateCompleted;
                    break;
                case 5:
                    status = "approved/s";
                    statusIcon = Styles.PrStateCompleted;
                    break;
                case -5:
                    status = "waiting";
                    statusIcon = Styles.PrStateWaiting;
                    break;
                case -10:
                    status = "rejected";
                    statusIcon = Styles.PrStateRejected;
                    break;
            }
        }

        let result: IWorkItem = {
            id: "pr"+this.PR.pullRequestId,
            title: { 
                text: this.PR.pullRequestId + ": " + this.PR.title,
                textNode: textNode,
                iconProps: Styles.PrIcon
            },
            state: {
                text: status || "Done",
                iconProps: statusIcon
            },
            assignedTo: this.PR.createdBy.displayName,
            area: Data.prepareRef(this.PR.sourceRefName),
            priority: 0,
            release: Data.prepareRef(this.PR.targetRefName)
        };

        return result;
    }

    public static prepareBranchName(name: string) {
        let t = name.split("/");
        t.shift();
        t.shift();
        return t.join("/");
    }

    public static preparePrUrl(url: string): string {
        url = url.replace("/_apis/git/repositories/", "/_git/");
        url = url.replace("/pullRequests/", "/pullrequest/");
        return url;
    }



    // mmm() {
    //     for (let i = 0; i<prs.length; ++i) {
    //         console.log("================================= "+prs[i].pullRequestId+" "+prs[i].title);
    //         let tt = threads[i];
    //         for (let ttt of tt) {    //        status!=undefined    commentType==1   @<3D9B988A-EDE5-4A09-8DA5-0FBA8AD493A8>
    //             console.log(">>>>"+ttt.status+" "+ttt.id+" PR:"+prs[i].pullRequestId);
    //             for (let cc of ttt.comments) {
    //                 console.log(cc.commentType+" "+cc.content);
    //             }
    //         }
    //     }

    // }
}

