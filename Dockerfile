# Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ws4kp.csproj ws4kp.sln ./
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app/publish

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app/publish .
# Ensure static assets are present in the working directory
COPY --from=build /src/Audio ./Audio/
COPY --from=build /src/Fonts ./Fonts/
COPY --from=build /src/Images ./Images/
COPY --from=build /src/Scripts ./Scripts/
COPY --from=build /src/Styles ./Styles/
COPY --from=build /src/index.html ./
COPY --from=build /src/twc3.html ./
COPY --from=build /src/manifest.json ./
COPY --from=build /src/web.config ./

ENV ASPNETCORE_ENVIRONMENT=Production
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "ws4kp.dll"]
