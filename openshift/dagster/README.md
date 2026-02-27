# Dagster Deployment for MET ETL

This directory contains the Kubernetes/OpenShift configuration for deploying Dagster to run the MET ETL jobs.

## Files

| File | Description |
|------|-------------|
| `dagster-instance.configmap.yaml` | ConfigMap containing the full Dagster instance configuration |
| `values.yaml` | Helm values for the Dagster chart |

## Prerequisites

- OpenShift CLI (`oc`) configured and logged in
- Helm 3.x installed
- Access to the target namespace (c72cba-dev, c72cba-test, or c72cba-prod)
- `dagster-postgresql-secret` Secret created with `DAGSTER_PG_PASSWORD`

## Deployment Steps

### 1. Set Target Namespace

```bash
export NAMESPACE=c72cba-dev  # or c72cba-test, c72cba-prod
```

### 2. Apply the ConfigMap

First, update the `job_namespace` value in `dagster-instance.configmap.yaml`:

```bash
# Replace placeholder with actual namespace
sed "s/REPLACE_WITH_NAMESPACE/${NAMESPACE}/g" dagster-instance.configmap.yaml | oc apply -n ${NAMESPACE} -f -
```

Or manually edit the file and apply:

```bash
oc apply -f dagster-instance.configmap.yaml -n ${NAMESPACE}
```

### 3. Install/Upgrade Dagster via Helm

```bash
# Add Dagster Helm repo (if not already added)
helm repo add dagster https://dagster-io.github.io/helm
helm repo update

# Install or upgrade
helm upgrade --install dagster dagster/dagster \
  --values values.yaml \
  --set runLauncher.config.k8sRunLauncher.jobNamespace=${NAMESPACE} \
  -n ${NAMESPACE}
```

### 4. Verify Deployment

```bash
# Check pods are running
oc get pods -n ${NAMESPACE} | grep dagster

# Check the ConfigMap
oc get configmap dagster-instance -n ${NAMESPACE} -o yaml
```

## Key Configuration

### fail_pod_on_run_failure

The `fail_pod_on_run_failure: true` setting in the run launcher ensures that:

- When a Dagster job fails, the pod exits with code 1
- Failed pods show as "Error" (red) in OpenShift UI instead of "Completed" (green)
- Makes job failures immediately visible without checking Dagit logs

### Environment-Specific Deployment

The `job_namespace` is intentionally not hardcoded. Always specify it during deployment:

| Environment | Namespace | Command |
|-------------|-----------|---------|
| Development | c72cba-dev | `--set runLauncher.config.k8sRunLauncher.jobNamespace=c72cba-dev -n c72cba-dev` |
| Test | c72cba-test | `--set runLauncher.config.k8sRunLauncher.jobNamespace=c72cba-test -n c72cba-test` |
| Production | c72cba-prod | `--set runLauncher.config.k8sRunLauncher.jobNamespace=c72cba-prod -n c72cba-prod` |

## Updating Configuration

### To update the dagster-instance ConfigMap:

1. Edit `dagster-instance.configmap.yaml`
2. Apply the change:
   ```bash
   sed "s/REPLACE_WITH_NAMESPACE/${NAMESPACE}/g" dagster-instance.configmap.yaml | oc apply -n ${NAMESPACE} -f -
   ```
3. Restart the dagster-daemon to pick up changes:
   ```bash
   oc rollout restart deployment/dagster-daemon -n ${NAMESPACE}
   ```

### To update Helm values:

1. Edit `values.yaml`
2. Run helm upgrade:
   ```bash
   helm upgrade dagster dagster/dagster \
     --values values.yaml \
     --set runLauncher.config.k8sRunLauncher.jobNamespace=${NAMESPACE} \
     -n ${NAMESPACE}
   ```

## Troubleshooting

### Check if fail_pod_on_run_failure is working

1. Trigger a job that you know will fail (or temporarily break DB credentials)
2. Watch the pod status:
   ```bash
   oc get pods -n ${NAMESPACE} -w | grep dagster-run
   ```
3. Check pod exit code:
   ```bash
   oc get pod <pod-name> -n ${NAMESPACE} -o jsonpath='{.status.containerStatuses[0].state.terminated.exitCode}'
   ```
   - Exit code `0` = success
   - Exit code `1` = failure (expected when job fails)

### View Dagster logs

```bash
# Daemon logs
oc logs -f deployment/dagster-daemon -n ${NAMESPACE}

# Webserver logs
oc logs -f deployment/dagster-webserver -n ${NAMESPACE}

# Specific run pod logs
oc logs <dagster-run-pod-name> -n ${NAMESPACE}
```
