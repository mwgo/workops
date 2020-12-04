import React = require("react");

import * as TfsGit from "azure-devops-extension-api/Git";

import { Styles } from "./Styles";
import { LinkItem } from "./LinkItem";
import { Data, IWorkItem } from "./Data";

export enum PrStatus {
    New,
    Ready,
    Done
}

export class PrInfo {
    readonly PR: TfsGit.GitPullRequest;
    readonly StatusInfo: string;
    readonly NComments: number;
    readonly Status: PrStatus;

    constructor(pr: TfsGit.GitPullRequest, threads: TfsGit.GitPullRequestCommentThread[]) {
        this.PR = pr;

        this.NComments = threads.filter(t => t.status==TfsGit.CommentThreadStatus.Active || t.status==TfsGit.CommentThreadStatus.Pending).length;
        
        this.StatusInfo = "Ready";
        if (pr.reviewers.some(r => r.vote<0)) this.StatusInfo = "Waiting";
        else if (this.NComments==1) this.StatusInfo = "Comment";
        else if (this.NComments>1) this.StatusInfo = this.NComments+" comments";
        else if (pr.reviewers.some(r => r.isRequired && r.vote==0)) this.StatusInfo = "Done";
        else if (pr.reviewers.some(r => !r.isRequired)) 
            if (pr.reviewers.every(r => !r.isRequired && r.vote==0)) this.StatusInfo = "Done";

        this.Status = this.StatusInfo=="Done" ? PrStatus.Done : PrStatus.Ready;
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

        let status = this.StatusInfo;
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

