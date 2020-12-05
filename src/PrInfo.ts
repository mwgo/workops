import React = require("react");

import * as TfsGit from "azure-devops-extension-api/Git";

import { Styles } from "./Styles";
import { LinkItem } from "./LinkItem";
import { Data, IWorkItem } from "./Data";
import { CommentType } from "azure-devops-extension-api/Git";
import { IIconProps } from "azure-devops-ui/Icon";

export enum PrStatus {
    New,
    Ready,
    Done,
    Other
}

export class PrInfo {
    readonly Data: Data;
    readonly PR: TfsGit.GitPullRequest;
    readonly IsMy: boolean;
    readonly StatusInfo: string;
    readonly StatusDesc: string;
    readonly Status: PrStatus;
    readonly Vote: number;

    constructor(data: Data, pr: TfsGit.GitPullRequest, threads: TfsGit.GitPullRequestCommentThread[]) {
        this.Data = data;
        this.PR = pr;
        this.IsMy = data.Settings.IsCurrentUser(pr.createdBy.uniqueName);

        threads = threads.filter(t => t.status==TfsGit.CommentThreadStatus.Active || t.status==TfsGit.CommentThreadStatus.Pending);

        let nactives = 0;
        let ncomments = 0;
        for (const thread of threads) {
            let comments = thread.comments.filter(c => !c.isDeleted && c.commentType==CommentType.Text);
            if (comments.length>0) {
                ++ncomments;
                let active = this.IsMy;

                for (const comment of comments) {
                    if (data.Settings.ContainsCurrentUser(comment.content)) active = true;
                    if (this.IsMy && comment.content.indexOf("@<")<0) active = true;
                    if (data.Settings.IsCurrentUser(comment.author.uniqueName)) active = false;
                }

                if (active) ++nactives;
            }
        }

        let reviewWaiting = pr.reviewers.some(r => r.isRequired && r.vote==0)
            || pr.reviewers.some(r => !r.isRequired) && pr.reviewers.every(r => !r.isRequired && r.vote==0);
        
        let myReview = pr.reviewers.find(rv => this.Data.Settings.IsCurrentUser(rv.uniqueName));
        this.Vote = myReview ? myReview.vote : 10;

        if (pr.isDraft) {
            this.StatusInfo = "Draft";
            this.StatusDesc = "PR is draft still";
            this.Status = PrStatus.Other;
        }
        else if (pr.status==TfsGit.PullRequestStatus.Abandoned) {
            this.StatusInfo = "Abandoned";
            this.StatusDesc = "Author abondon PR";
            this.Status = PrStatus.Other;
        }
        else if (pr.status==TfsGit.PullRequestStatus.Completed) {
            this.StatusInfo = "Completed";
            this.StatusDesc = "Author complete PR";
            this.Status = PrStatus.Other;
        }
        else {
            if (this.IsMy) {
                if (pr.reviewers.some(r => r.vote==-5)) {
                    this.StatusInfo = "Waiting Me";
                    this.StatusDesc = "Reviewers require me for action";
                    this.Status = PrStatus.Ready;
                }
                else if (pr.reviewers.some(r => r.vote==-10)) {
                    this.StatusInfo = "Waiting Me";
                    this.StatusDesc = "Reviewers abandoned the PR";
                    this.Status = PrStatus.Ready;
                }
                else if (nactives==1) {
                    this.StatusInfo = "Comment";
                    this.StatusDesc = "There is unaswered comment";
                    this.Status = PrStatus.Ready;
                }        
                else if (nactives>1) {
                    this.StatusInfo = "Comments";
                    this.StatusDesc = "There are unaswered comments";
                    this.Status = PrStatus.Ready;
                }        
                else if (reviewWaiting) {
                    this.StatusInfo = "Review";
                    this.StatusDesc = "Waiting reviewers for review";
                    this.Status = PrStatus.Done;
                }
                else if (ncomments==1) {
                    this.StatusInfo = "Active Comment";
                    this.StatusDesc = "There is active comment before complete";
                    this.Status = PrStatus.Ready;
                }        
                else if (ncomments>1) {
                    this.StatusInfo = "Active Comments "+ncomments;
                    this.StatusDesc = "There are active comments before complete";
                    this.Status = PrStatus.Ready;
                }        
                else {
                    this.StatusInfo = "Ready";
                    this.StatusDesc = "PR is ready to complete";
                    this.Status = PrStatus.Ready;
                }
            }
            else {
                switch (this.Vote) {
                    case 10:
                        this.StatusInfo = "Approved";
                        this.StatusDesc = "PR is approved by me";
                        this.Status = PrStatus.Done;
                        break;
                    case 5:
                        this.StatusInfo = "Approved/S";
                        this.StatusDesc = "PR is approved with suggestions by me";
                        this.Status = PrStatus.Done;
                        break;
                    case 0:
                        this.StatusInfo = "Review";
                        this.StatusDesc = "PR is waiting for my review";
                        this.Status = PrStatus.Ready;
                        break;
                    case -5:
                        this.StatusInfo = "Waiting";
                        this.StatusDesc = "Author is requested for action by me";
                        this.Status = PrStatus.New;
                        break;
                    case -10:
                        this.StatusInfo = "Rejected";
                        this.StatusDesc = "PR is rejected by me";
                        this.Status = PrStatus.Done;
                        break;
                    default:
                        this.StatusInfo = "Unknown";
                        this.StatusDesc = "Unknown my review state";
                        this.Status = PrStatus.Ready;
                        break;
                }
            }
            if (nactives>0) {
                this.StatusInfo = this.StatusInfo+" ("+nactives+")";
                this.Status = PrStatus.Ready;
                if (nactives==1)
                    this.StatusDesc += ", one unanswered comment by me";
                else
                    this.StatusDesc += ", "+nactives+" unanswered comments by me";
            }
        }
    }

    createWorkItem(): IWorkItem {
        let textNode: React.ReactNode = this.PR.pullRequestId + ": " + this.PR.title;

        let url = this.PR.url;
        url = url.replace("/_apis/git/repositories/", "/_git/");
        url = url.substring(0, url.indexOf("/pullRequests/"));
        url = url+"?version=GB";

        let sourceBranch = PrInfo.prepareBranchName(this.PR.sourceRefName);
        let targetBranch = PrInfo.prepareBranchName(this.PR.targetRefName);

        this.Data.LinksInfo[sourceBranch] = {
            name: sourceBranch,
            title: sourceBranch,
            url: url+sourceBranch.replace("/", "%2f")
        };
        this.Data.LinksInfo[targetBranch] = {
            name: targetBranch,
            title: targetBranch,
            url: url+targetBranch.replace("/", "%2f")
        };

        let rels : React.ReactNode[] = [
            React.createElement(LinkItem, {
                Data: this.Data, 
                Link: sourceBranch, 
                ID: -1, 
                Icon: Styles.LinkBranchIconName, 
                key: "pr_source"+this.PR.pullRequestId
            }),
            " ",
            React.createElement(LinkItem, {
                Data: this.Data, 
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


        let statusIcon: IIconProps;
        if (this.IsMy) {
            switch (this.Status) {
                case PrStatus.New:
                    statusIcon = Styles.PrStateWaiting;
                    break;
                case PrStatus.Ready:
                    statusIcon = Styles.PrStateActive;
                    break;
                case PrStatus.Done:
                    statusIcon = Styles.PrStateCompleted;
                    break;
                default:
                    statusIcon = Styles.PrStateWaiting;
                    break;
            }
        }
        else {
            switch (this.Vote) {
                case 10:
                case 5:
                    statusIcon = Styles.PrStateCompleted;
                    break;
                case -5:
                    statusIcon = Styles.PrStateWaiting;
                    break;
                case -10:
                    statusIcon = Styles.PrStateRejected;
                    break;
                default:
                    statusIcon = Styles.PrStateActive;
                    break;
            }
        }
        statusIcon = {
            iconName: statusIcon.iconName,
            style: statusIcon.style,
            title: this.StatusDesc
        };

        let result: IWorkItem = {
            id: "pr"+this.PR.pullRequestId,
            title: { 
                text: this.PR.pullRequestId + ": " + this.PR.title,
                textNode: textNode,
                iconProps: Styles.PrIcon
            },
            state: {
                text: this.StatusInfo,
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

}

