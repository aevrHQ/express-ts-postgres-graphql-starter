FROM node:lts as builder

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./

RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run compile

# Copy Prisma binaries to dist/generated (assuming standard output structure)
# Ensure the directory exists first (tsc might have created it, but just in case)
RUN mkdir -p dist/generated/prisma
RUN cp -r src/generated/prisma/libquery_engine* dist/generated/prisma/ || true

FROM node:lts-slim

ENV NODE_ENV production
USER node

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./

RUN npm ci --production

COPY --from=builder /usr/src/app/dist ./dist

EXPOSE 8080
CMD [ "node", "dist/index.js" ]