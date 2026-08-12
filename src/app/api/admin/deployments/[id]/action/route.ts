import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";

// Quote a value for safe use inside a POSIX single-quoted shell string.
function shellQuote(value: unknown): string {
  const str = String(value);
  if (str === "") return "''";
  if (!/^[a-zA-Z0-9_.:@/\-]+$/.test(str)) {
    return "'" + str.replace(/'/g, "'\"'\"'") + "'";
  }
  return str;
}

// POST: Execute deployment action (command builder)
export const POST = withAuth(
  async (request, session, context) => {
    const { id } = await context.params;

    try {
      const body = await request.json();
      const { action } = body;

      const validActions = ["deploy", "start", "stop", "restart", "rebuild", "destroy"];
      if (!action || !validActions.includes(action)) {
        return NextResponse.json(
          { error: `Invalid action. Must be one of: ${validActions.join(", ")}` },
          { status: 400 }
        );
      }

      // Fetch deployment with ECS info
      const deployment = await prisma.lguDeployment.findUnique({
        where: { id },
        include: { ecsInstance: true },
      });

      if (!deployment) {
        return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
      }

      const ecs = deployment.ecsInstance;
      const containerName = shellQuote(deployment.containerName);
      const imageTag = shellQuote(deployment.imageTag || "latest");
      const port = Number(deployment.containerPort) || 3000;
      const imageName = shellQuote(`esangguni-lgu/${deployment.lguId}:${deployment.imageTag || "latest"}`);

      // Build environment variables for docker run (shell-quote every value)
      const envVars: string[] = [
        `-e NODE_ENV=production`,
        `-e LGU_ID=${shellQuote(deployment.lguId)}`,
        `-e LGU_NAME=${shellQuote(deployment.lguName)}`,
        `-e PORT=${port}`,
      ];
      if (deployment.openrouterApiKey) {
        envVars.push(
          `-e OPENROUTER_API_KEY=${shellQuote(deployment.openrouterApiKey)}`
        );
      }
      if (deployment.lightragServiceUrl) {
        envVars.push(
          `-e LIGHTRAG_SERVICE_URL=${shellQuote(deployment.lightragServiceUrl)}`
        );
      }
      if (deployment.domain) {
        envVars.push(`-e DOMAIN=${shellQuote(deployment.domain)}`);
      }

      // Parse additional env vars from stored JSON (Prisma returns native object)
      if (deployment.envVars) {
        try {
          const extra = typeof deployment.envVars === "object"
            ? deployment.envVars as Record<string, string>
            : JSON.parse(String(deployment.envVars));
          for (const [key, val] of Object.entries(extra)) {
            envVars.push(`-e ${shellQuote(key)}=${shellQuote(val)}`);
          }
        } catch {
          // Ignore malformed env_vars
        }
      }

      let commands: string[] = [];
      let newStatus: string = deployment.status;
      let description = "";

      switch (action) {
        case "deploy":
          commands = [
            `docker pull ${imageName}`,
            `docker stop ${containerName} 2>/dev/null || true`,
            `docker rm ${containerName} 2>/dev/null || true`,
            `docker run -d \\
  --name ${containerName} \\
  --restart unless-stopped \\
  -p ${port}:${port} \\
  -v ${shellQuote(`esangguni-${deployment.lguId}-data`)}:/app/data \\
  ${envVars.join(" \\\n  ")} \\
  ${imageName}`,
          ];
          newStatus = "running";
          description = "Pull image, stop existing container, and start new instance";
          break;

        case "start":
          commands = [
            `docker start ${containerName}`,
          ];
          newStatus = "running";
          description = "Start the stopped container";
          break;

        case "stop":
          commands = [
            `docker stop ${containerName}`,
          ];
          newStatus = "stopped";
          description = "Stop the running container gracefully";
          break;

        case "restart":
          commands = [
            `docker restart ${containerName}`,
          ];
          newStatus = "running";
          description = "Restart the running container";
          break;

        case "rebuild":
          commands = [
            `docker compose -f ${shellQuote(`/opt/esangguni/${deployment.lguId}/docker-compose.yml`)} build --no-cache`,
            `docker compose -f ${shellQuote(`/opt/esangguni/${deployment.lguId}/docker-compose.yml`)} up -d --force-recreate`,
          ];
          newStatus = "building";
          description = "Rebuild image without cache and recreate container";
          break;

        case "destroy":
          commands = [
            `docker stop ${containerName}`,
            `docker rm ${containerName}`,
            `docker volume rm ${shellQuote(`esangguni-${deployment.lguId}-data`)} 2>/dev/null || true`,
          ];
          newStatus = "stopped";
          description = "Stop, remove container, and clean up volumes";
          break;
      }

      // Update deployment status and last_deployed_at
      const now = new Date();
      await prisma.lguDeployment.update({
        where: { id },
        data: {
          status: newStatus,
          lastDeployedAt: now,
        },
      });

      // Build SSH command prefix (for future execution)
      const sshTarget =
        ecs?.sshUser && ecs?.publicIp
          ? `${shellQuote(ecs.sshUser)}@${shellQuote(ecs.publicIp)}`
          : null;
      const sshPort = Number(ecs?.sshPort);
      const sshOpts =
        ecs?.sshPort && sshPort !== 22 && sshPort > 0
          ? `-p ${sshPort}`
          : "";
      const sshKeyOpt = ecs?.sshKeyPath
        ? `-i ${shellQuote(ecs.sshKeyPath)}`
        : "";

      return NextResponse.json({
        deployment_id: id,
        action,
        description,
        commands,
        ssh: {
          target: sshTarget,
          options: [sshKeyOpt, sshOpts].filter(Boolean).join(" "),
          full_command: sshTarget
            ? `ssh ${[sshKeyOpt, sshOpts].filter(Boolean).join(" ")} ${sshTarget}`
            : "SSH connection not configured",
        },
        deployment_config: {
          lgu_id: deployment.lguId,
          lgu_name: deployment.lguName,
          container_name: containerName,
          image: imageName,
          port,
          ecs_instance: ecs?.name,
          ecs_ip: ecs?.publicIp,
        },
        updated_status: newStatus,
        executed_at: now.toISOString(),
        note: "Commands generated only. SSH execution will be implemented in a future update.",
      });
    } catch (err) {
      console.error("[admin/deployments/[id]/action] POST error:", err);
      return NextResponse.json(
        { error: "Failed to execute deployment action" },
        { status: 500 }
      );
    }
  },
  { requireSuperAdmin: true }
);
