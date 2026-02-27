# Dagster Deployment Guide

## Configuration Files

The Dagster deployment configuration is maintained in the repository at:
- `openshift/dagster/dagster-instance.configmap.yaml` - Dagster instance configuration
- `openshift/dagster/values.yaml` - Helm chart values
- `openshift/dagster/README.md` - Detailed deployment instructions

## Deployment Steps

### 1 On OpenShift:
Go to system:image-puller in rolebindings and add the following lines in the subject:

```yaml
- kind: ServiceAccount
  name: dagster-dagster-user-deployments-user-deployments
  namespace: c72cba-prod  # or target namespace
```

### 2 Create Secrets:
Ensure the following secrets exist in the target namespace:
- `dagster-postgresql-secret` - Contains `DAGSTER_PG_PASSWORD`
- `met-dagster` - MET database credentials

### 3 Apply the ConfigMap:
```bash
export NAMESPACE=c72cba-dev  # or c72cba-test, c72cba-prod

# Replace namespace placeholder and apply
sed "s/REPLACE_WITH_NAMESPACE/${NAMESPACE}/g" \
  openshift/dagster/dagster-instance.configmap.yaml | oc apply -n ${NAMESPACE} -f -
```

### 4 Install Dagster:
Run the following command to install Dagster using Helm:

```bash
helm repo add dagster https://dagster-io.github.io/helm
helm repo update

helm upgrade --install dagster dagster/dagster \
  --values openshift/dagster/values.yaml \
  --set runLauncher.config.k8sRunLauncher.jobNamespace=${NAMESPACE} \
  -n ${NAMESPACE}
```

### 5 Role Bindings:
Add dagster-admin to role bindings.

### 6 Verify Deployment:
```bash
oc get pods -n ${NAMESPACE} | grep dagster
```

## Key Configuration Notes

- **fail_pod_on_run_failure**: Set to `true` in the run launcher config. This ensures failed jobs show as failed pods in OpenShift (exit code 1) rather than completed (exit code 0).

- **job_namespace**: Not hardcoded - always specify via `--set` flag during deployment.

## Version Information

- Dagster Helm Chart: See values.yaml for current version
- Dagster Python Package: 1.7.15 (see met-etl/requirements.txt)

## Troubleshooting

See `openshift/dagster/README.md` for detailed troubleshooting steps.
