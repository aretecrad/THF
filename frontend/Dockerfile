FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Both are read at build time: the /api rewrite target and the privacy page's contact.
ARG BACKEND_URL=http://backend:4000
ARG PRIVACY_CONTACT_EMAIL=
ENV BACKEND_URL=$BACKEND_URL PRIVACY_CONTACT_EMAIL=$PRIVACY_CONTACT_EMAIL
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
