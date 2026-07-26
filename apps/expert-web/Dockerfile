FROM node:24-alpine AS build

WORKDIR /workspace
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/expert-web/package.json apps/expert-web/package.json
RUN pnpm install --filter @rivonclaw/expert-web --frozen-lockfile --ignore-scripts

COPY apps/expert-web apps/expert-web
RUN pnpm --filter @rivonclaw/expert-web build

FROM nginx:alpine

COPY --from=build /workspace/apps/expert-web/dist /usr/share/nginx/html
COPY apps/expert-web/nginx.conf /etc/nginx/conf.d/default.conf
