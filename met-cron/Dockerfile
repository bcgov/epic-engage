FROM python:3.12-slim-bookworm

# ========================================================================================================
# Install go-crond (from https://github.com/BCDevOps/go-crond)
#  - Adds some additional logging enhancements on top of the upstream project;
#    https://github.com/webdevops/go-crond
#
# CRON Jobs in OpenShift:
# - https://blog.danman.eu/cron-jobs-in-openshift/
#
# --------------------------------------------------------------------------------------------------------
ARG SOURCE_REPO=webdevops
ARG GOCROND_VERSION=23.12.0
ARG VCS_REF="missing"
ARG BUILD_DATE="missing"

ENV VCS_REF=${VCS_REF}
ENV BUILD_DATE=${BUILD_DATE}

LABEL org.label-schema.vcs-ref=${VCS_REF} \
    org.label-schema.build-date=${BUILD_DATE}

# Install curl and other necessary packages
RUN apt-get update && \
    apt-get install -y \
    curl \
    bash \
    git \
    libpq5 \
    && apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN curl https://github.com/$SOURCE_REPO/go-crond/releases/download/$GOCROND_VERSION/go-crond.linux.amd64 -s -L -o /usr/local/bin/go-crond
RUN chmod ug+x /usr/local/bin/go-crond
# ========================================================================================================

# Add a job user
ARG uid=1001
ARG user=pay
RUN useradd -U -ms /bin/bash -u $uid $user \
    && usermod -a -G root $user

ENV HOME=/met-cron

RUN mkdir $HOME && chmod 755 $HOME

WORKDIR $HOME

# Install the requirements
# Build context is the REPO ROOT (not met-cron/), because met-cron depends on
# met-api, which lives in this repo. requirements/repo-libraries.txt installs it
# from ../met-api, so met-api must be present before pip runs.
COPY met-cron/requirements.txt .
COPY met-cron/requirements/ ./requirements/
COPY met-api/ /met-api/
COPY met-cron/ .

RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# --no-deps: requirements.txt is the single source of truth for versions.
# Without it, setup.py re-resolves requirements/prod.txt and can silently
# replace the pins installed above.
RUN pip install --no-deps .

# Set Python path
ENV PYTHONPATH=/met-cron/src


# Set ownership and permissions
# Set scripts as executable (make files and python files do not have to be marked)
# Make /etc/passwd writable for the root group so an entry can be created for an OpenShift assigned user account.
RUN chown -R $user:root $HOME \
    && chmod -R ug+rw $HOME \
    && chmod ug+x $HOME/*.sh \
    && chmod g+rw /etc/passwd \
    && chmod g-w $HOME/cron/crontab

USER $user
ENTRYPOINT ["bash", "docker-entrypoint.sh"]