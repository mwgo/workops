import { 
    getService,
    getUser,
    IUserContext
} from "azure-devops-extension-sdk";
import { 
    getClient,
    CommonServiceIds, 
    IProjectInfo,
    IProjectPageService
} from "azure-devops-extension-api";
import * as TfsWork from "azure-devops-extension-api/Work";
import * as TfsCore from "azure-devops-extension-api/Core";
import * as TfsClient from "azure-devops-extension-api/Work/WorkClient";

import { IListBoxItem } from "azure-devops-ui/ListBox";
import { Data } from "./Data";

//
//
//

export class SettingsData {

    private static version = 1;

    private currentVersion = SettingsData.version;

    CurrentProject: IProjectInfo = { id: "", name: "" };
    CurrentUser?: IUserContext;
    CurrentIterationPath = "";

    Iterations: IListBoxItem<IIterationItem>[] = [];

    static create(data: Data) {
        let json = localStorage.getItem("workops_settings");
        if (json) {
            let jsondata = JSON.parse(json);
            let sdata = Object.assign(new SettingsData(), jsondata) as SettingsData;

            if (sdata && sdata.isReady && sdata.currentVersion==SettingsData.version) {
                let prevJson = json;
                setTimeout(() => sdata.load(prevJson, data), 3000);
                return sdata;
            }
        }

        let s = new SettingsData();
        setTimeout(() => s.load("", data), 100);
        return s;
    }

    public get isReady() : boolean {
        return !!this.CurrentProject.id;
    }

    private async load(prevJson: string, data: Data) {
        await this.retrieve();
        let json = JSON.stringify(this);
        if (json!=prevJson) {
            localStorage.setItem("workops_settings", json);
            data.refresh();
        }
    }

    private async retrieve() {
        const navService = await getService<IProjectPageService>(CommonServiceIds.ProjectPageService);
        let p = await navService.getProject();
        if (p)
            this.CurrentProject = p;
        this.CurrentUser = getUser();

        await this.retrieveIterations();
    }

    private async retrieveIterations() {
        if (!this.CurrentProject) return [];

        let coreClient = getClient(TfsCore.CoreRestClient);
        let workClient = getClient(TfsClient.WorkRestClient);

        let projectId = this.CurrentProject.id;

        let teams = await coreClient.getTeams(this.CurrentProject.id, true, 50);

        let titerations = await Promise.all(teams.map(team => {
            let teamContext: TfsCore.TeamContext = { projectId: projectId, teamId: team.id, project: "", team: "" };
            return workClient.getTeamIterations(teamContext);
        }));


        let time = new Date().getTime() - 40*24*60*60*1000;
        let iterations: TfsWork.TeamSettingsIteration[] = [];
        for (const tit of titerations) {
            for (const it of tit) {
                if (!it.attributes.finishDate || it.attributes.finishDate.getTime()>time) 
                    if (iterations.findIndex(i => it.id==i.id)<=0)
                        iterations.push(it);
            }
        }

        let iterIdx = iterations.findIndex(i => SettingsData.isCurrentIteration(i));
        if (iterIdx<0) iterIdx = iterations.findIndex(i => SettingsData.isCurrentIteration2(i));

        if (iterIdx<0 && iterations.length>0) iterIdx = iterations.length-1;
        this.CurrentIterationPath = iterIdx<0 ? "" : iterations[iterIdx].path;

        this.Iterations.splice(0, this.Iterations.length);

        for (let it of iterations) {
            let sufix = "";
            if (this.CurrentIterationPath==it.path) sufix += " (Current)";
            this.Iterations.push({ 
                id: it.path, 
                text: it.name+sufix,
                iconProps: { iconName: "Sprint" }
            }); 
        }
    }

    private static isCurrentIteration(iter: TfsWork.TeamSettingsIteration): boolean {
        let dt = Date.now();
        
        let start = iter.attributes.startDate;
        if (!start) start = new Date();

        let finish = iter.attributes.finishDate;
        if (!finish) finish = new Date();
        finish.setDate(finish.getDate()+1);

        return start.getTime()<=dt && dt<finish.getTime();
    }

    private static isCurrentIteration2(iter: TfsWork.TeamSettingsIteration): boolean {
        let dt = Date.now();
        
        let start = iter.attributes.startDate;
        if (!start || dt>start.getTime()) return false;

        let finish = iter.attributes.finishDate;
        if (finish && dt>finish.getTime()) return false;

        return true;
    }

}

export interface IIterationItem {
    id: string;
    text: string;
    iteration: TfsWork.TeamSettingsIteration;
}

