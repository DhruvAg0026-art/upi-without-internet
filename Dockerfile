FROM node:20-alpine AS build

WORKDIR /app
COPY package.json ./
COPY Frontend/package.json ./Frontend/package.json
COPY Backend/package.json ./Backend/package.json
RUN npm install

COPY Frontend ./Frontend
COPY Backend ./Backend
RUN npm run build --workspace Frontend

FROM node:20-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY package.json ./
COPY Frontend/package.json ./Frontend/package.json
COPY Backend/package.json ./Backend/package.json
RUN npm install --omit=dev --workspace Backend --include-workspace-root=false

COPY Backend ./Backend
COPY --from=build /app/Frontend/dist /app/Frontend/dist

EXPOSE 8080
CMD ["npm", "run", "start", "--workspace", "Backend"]
