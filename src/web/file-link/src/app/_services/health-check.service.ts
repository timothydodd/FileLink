import { HttpClient } from "@angular/common/http"
import { Injectable } from "@angular/core"
import { environment } from "../../environments/environment"
import { HealthCheck } from "../pages/error-page/error-page.component"
import { InterceptorHttpParams } from "./auth/auth-interceptor.service"

@Injectable({ providedIn: 'root' })
export class HealthCheckService {


    constructor(private http: HttpClient) {

    }
    getfilelink() {
        const params = new InterceptorHttpParams({ noToken: true })
        return this.http.get<HealthCheck>(
            `${environment.apiUrl}/health`, { params: params })
        }
}