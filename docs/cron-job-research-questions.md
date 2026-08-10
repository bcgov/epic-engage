# met-cron job performance

## The change

```yaml
resources:
  cpu:
    limit: 1000m      # was 100m
    request: 100m     # unchanged
  memory:
    limit: 512Mi      # unchanged, see below
    request: 100Mi
```

1000m rather than 500m because start-up is single-threaded, so 1000m is where
the limit stops being the constraint; 500m would leave about a second of
avoidable start-up on each of ~600 runs a day. Not more, because a 200% quota
tested no faster than 100% on the same single-threaded work.

The request stays at 100m: it drives scheduling and namespace quota, while the
limit only caps bursts. The namespace quota caps `requests.cpu` and not limits,
so this change consumes no extra quota.

## Start-up time, before and after

Start-up costs ~0.93 CPU-seconds. At a 100m limit that took 7.4s of wall time;
at 1000m it takes ~0.83s.

Measured from pod logs by pairing `go-crond`'s `msg=executing` timestamp with
the application's `<<<< Starting Jobs >>>>` and `<<<< Completed … >>>>` lines,
over 453 runs of `met_publish` in dev:

| Phase | Before (100m) | After (1000m) |
|---|---:|---:|
| Start-up | 7.3s | 0.83s |
| Work | 1.0s | 0.10s |
| Teardown | 1.7s | 0.07s |
| **Total** | **10.2s** | **0.97s** |

Start-up and teardown were 88% of every run before the change.

## Peak memory of a single job run

~85 MB per job process.

| Measurement | Before | After |
|---|---:|---:|
| Container at idle (go-crond only) | 29 to 35 MiB | n/a |
| Peak RSS of one job process | 84.8 MB | 86.9 MB |
| Container peak while one job runs | 98.9 to 100.3 MiB | 82 MiB |

## Memory headroom for two overlapping jobs

512Mi is enough. Two overlapping jobs reached ~165 MiB before the change and
~147 MiB after, about 29% of the limit.

### Memory limit: no increase needed

512Mi was not the constraint and was left unchanged. Raising the CPU limit also
reduces memory pressure, because jobs finish roughly ten times faster and
overlap far less often: the two-job peak fell from 165 to 147 MiB.

## Corrections to the previous estimates

| | Estimate on file | Measured |
|---|---|---|
| Start-up processor work | 4 to 5 CPU-seconds | 0.93 CPU-seconds |
| Start-up wall time at 100m | ~45s | 7.4s |
| Peak memory per run | 150 to 250 MB | ~85 MB |
