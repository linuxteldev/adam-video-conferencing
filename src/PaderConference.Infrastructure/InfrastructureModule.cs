using Autofac;
using PaderConference.Core.Interfaces.Gateways.Repositories;
using PaderConference.Core.Interfaces.Services;
using PaderConference.Core.Services;
using PaderConference.Infrastructure.Auth;
using PaderConference.Infrastructure.Auth.AuthService;
using PaderConference.Infrastructure.Conferencing;
using PaderConference.Infrastructure.Data;
using PaderConference.Infrastructure.Data.Repos;
using PaderConference.Infrastructure.Hubs;
using PaderConference.Infrastructure.Interfaces;
using PaderConference.Infrastructure.Redis;
using PaderConference.Infrastructure.Services;
using PaderConference.Infrastructure.Sockets;

namespace PaderConference.Infrastructure
{
    public class InfrastructureModule : Module
    {
        protected override void Load(ContainerBuilder builder)
        {
            builder.RegisterType<JwtFactory>().As<IJwtFactory>().SingleInstance();
            builder.RegisterType<JwtHandler>().As<IJwtHandler>().SingleInstance();
            builder.RegisterType<TokenFactory>().As<ITokenFactory>().SingleInstance();
            builder.RegisterType<JwtValidator>().As<IJwtValidator>().SingleInstance();
            builder.RegisterType<RefreshTokenFactory>().As<IRefreshTokenFactory>().SingleInstance();

            builder.RegisterType<ConferenceManager>().As<IConferenceManager>().SingleInstance();
            builder.RegisterType<ConnectionMapping>().As<IConnectionMapping>().SingleInstance();

            builder.RegisterAssemblyTypes(ThisAssembly).AsClosedTypesOf(typeof(IConferenceServiceManager<>))
                .AsImplementedInterfaces().SingleInstance();

            builder.RegisterAssemblyTypes(ThisAssembly).AssignableTo<IRedisRepo>().AsImplementedInterfaces()
                .SingleInstance();

            builder.RegisterType<SignalrMessenger<CoreHub>>().AsImplementedInterfaces().SingleInstance();

            builder.RegisterAssemblyTypes(ThisAssembly).AsClosedTypesOf(typeof(MongoRepo<>)).AsSelf()
                .AsImplementedInterfaces().InstancePerDependency();

            builder.RegisterType<CachedConferenceRepo>().As<IConferenceRepo>().InstancePerDependency();

            builder.RegisterType<OptionsAuthService>().AsImplementedInterfaces().SingleInstance();

            builder.RegisterType<ServiceInvokerFactory>().AsImplementedInterfaces().SingleInstance();
        }
    }
}
