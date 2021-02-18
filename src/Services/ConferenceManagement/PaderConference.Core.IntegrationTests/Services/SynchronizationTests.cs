﻿using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Autofac;
using Moq;
using PaderConference.Core.Domain.Entities;
using PaderConference.Core.IntegrationTests.Services.Base;
using PaderConference.Core.Services.ConferenceControl.Notifications;
using PaderConference.Core.Services.Synchronization;
using PaderConference.Core.Services.Synchronization.Gateways;
using PaderConference.Core.Services.Synchronization.Notifications;
using PaderConference.Core.Services.Synchronization.Requests;
using Xunit;
using Xunit.Abstractions;

namespace PaderConference.Core.IntegrationTests.Services
{
    public class SynchronizationTests : ServiceIntegrationTest
    {
        private const string SyncObjId = "hello";
        private const string ConferenceId = "45";

        private const string ParticipantIdWithPermissions = "p1";
        private const string ParticipantIdWithoutPermissions = "p2";
        private string SyncObjValue = "value";

        private readonly Mock<ISynchronizedObjectProvider> _providerMock = new();

        public SynchronizationTests(ITestOutputHelper testOutputHelper) : base(testOutputHelper)
        {
        }

        protected override IEnumerable<Type> FetchServiceTypes()
        {
            return FetchTypesOfNamespace(typeof(SynchronizedObjectId));
        }

        protected override void ConfigureContainer(ContainerBuilder builder)
        {
            base.ConfigureContainer(builder);

            var conference = new Conference(ConferenceId);
            AddConferenceRepo(builder, conference);

            SetHasPermissionsForParticipant(ParticipantIdWithPermissions);
            SetHasNoPermissionsForParticipant(ParticipantIdWithoutPermissions);

            _providerMock.Setup(x => x.Id).Returns(SyncObjId);
            _providerMock
                .Setup(x => x.FetchValue(It.IsAny<string>(), It.Is<SynchronizedObjectId>(s => s.Id == SyncObjId)))
                .ReturnsAsync(() => SyncObjValue);

            builder.RegisterInstance(_providerMock.Object).As<ISynchronizedObjectProvider>();
        }

        private void SetHasPermissionsForParticipant(string participantId)
        {
            _providerMock.Setup(x => x.GetAvailableObjects(ConferenceId, participantId))
                .ReturnsAsync(new List<SynchronizedObjectId> {new(SyncObjId)});
        }

        private void SetHasNoPermissionsForParticipant(string participantId)
        {
            _providerMock.Setup(x => x.GetAvailableObjects(ConferenceId, participantId))
                .ReturnsAsync(new List<SynchronizedObjectId>());
        }

        [Fact]
        public async Task ParticipantJoined_WithPermissions_PublishSynchronizedObjectUpdatedNotification()
        {
            // arrange
            var notification = new ParticipantJoinedNotification(ParticipantIdWithPermissions, ConferenceId);

            // act
            await Mediator.Publish(notification);

            // assert
            NotificationCollector.AssertSingleNotificationIssued<SynchronizedObjectUpdatedNotification>(n =>
            {
                Assert.Equal(SyncObjId, n.SyncObjId);
                Assert.Equal(ConferenceId, n.ConferenceId);
                Assert.Equal(SyncObjValue, n.Value);
                Assert.Equal(ParticipantIdWithPermissions, Assert.Single(n.ParticipantIds));
            });
        }

        [Fact]
        public async Task ParticipantJoined_WithoutPermissions_DoNothing()
        {
            // arrange
            var notification = new ParticipantJoinedNotification(ParticipantIdWithoutPermissions, ConferenceId);

            // act
            await Mediator.Publish(notification);

            // assert
            NotificationCollector.AssertSingleNotificationIssued<ParticipantJoinedNotification>();
            NotificationCollector.AssertNoMoreNotifications();
        }

        [Fact]
        public async Task
            UpdateSynchronizedObjectRequest_TwoParticipants_SendNewObjectOnlyToParticipantWithPermissions()
        {
            const string newValue = "newVal";

            // arrange
            await Mediator.Publish(new ParticipantJoinedNotification(ParticipantIdWithPermissions, ConferenceId));
            await Mediator.Publish(new ParticipantJoinedNotification(ParticipantIdWithoutPermissions, ConferenceId));

            NotificationCollector.Reset();
            SyncObjValue = newValue;

            // act
            var updateRequest =
                new UpdateSynchronizedObjectRequest(ConferenceId, SynchronizedObjectId.Parse(SyncObjId));
            await Mediator.Send(updateRequest);

            // assert
            NotificationCollector.AssertSingleNotificationIssued<SynchronizedObjectUpdatedNotification>(n =>
            {
                Assert.Equal(SyncObjId, n.SyncObjId);
                Assert.Equal(ConferenceId, n.ConferenceId);
                Assert.Equal(newValue, n.Value);
                Assert.Equal(ParticipantIdWithPermissions, Assert.Single(n.ParticipantIds));
            });
            NotificationCollector.AssertNoMoreNotifications();
        }

        [Fact]
        public async Task UpdateSynchronizedObjectRequest_OneParticipantWithPermissions_VerifyPreviousValue()
        {
            const string newValue = "newVal";

            // arrange
            await Mediator.Publish(new ParticipantJoinedNotification(ParticipantIdWithPermissions, ConferenceId));

            NotificationCollector.Reset();
            var oldValue = SyncObjValue;
            SyncObjValue = newValue;

            // act
            var updateRequest =
                new UpdateSynchronizedObjectRequest(ConferenceId, SynchronizedObjectId.Parse(SyncObjId));
            await Mediator.Send(updateRequest);

            // assert
            NotificationCollector.AssertSingleNotificationIssued<SynchronizedObjectUpdatedNotification>(n =>
            {
                Assert.Equal(oldValue, n.PreviousValue);
            });
        }

        [Fact]
        public async Task UpdateSynchronizedObjectRequest_ObjectDidNotChange_DontPublishChangedNotification()
        {
            // arrange
            await Mediator.Publish(new ParticipantJoinedNotification(ParticipantIdWithPermissions, ConferenceId));

            NotificationCollector.Reset();

            // act
            var updateRequest =
                new UpdateSynchronizedObjectRequest(ConferenceId, SynchronizedObjectId.Parse(SyncObjId));
            await Mediator.Send(updateRequest);

            // assert
            NotificationCollector.AssertNoMoreNotifications();
        }

        [Fact]
        public async Task ParticipantLeft_WasTheOnlyParticipant_ClearSubscriptionsAndCachedSyncObject()
        {
            // arrange
            await Mediator.Publish(new ParticipantJoinedNotification(ParticipantIdWithPermissions, ConferenceId));
            Assert.NotEmpty(Data.Data);

            // act
            await Mediator.Publish(
                new ParticipantLeftNotification(ParticipantIdWithPermissions, ConferenceId, "connid"));

            // assert
            Assert.Empty(Data.Data);
        }

        [Fact]
        public async Task ParticipantLeft_AnotherParticipantJoined_DontClearCachedSyncObject()
        {
            var participantId2WithPermissions = "234";

            // arrange
            SetHasPermissionsForParticipant(participantId2WithPermissions);

            await Mediator.Publish(new ParticipantJoinedNotification(ParticipantIdWithPermissions, ConferenceId));
            await Mediator.Publish(new ParticipantJoinedNotification(participantId2WithPermissions, ConferenceId));

            // act
            await Mediator.Publish(
                new ParticipantLeftNotification(ParticipantIdWithPermissions, ConferenceId, "connid"));

            // assert
            Assert.NotEmpty(Data.Data);

            var syncObjRepo = Container.Resolve<ISynchronizedObjectRepository>();
            Assert.NotNull(await syncObjRepo.Get(ConferenceId, SyncObjId, SyncObjValue.GetType()));
        }

        [Fact]
        public async Task UpdateSubscriptions_NothingChanged_DoNothing()
        {
            // arrange
            await Mediator.Publish(new ParticipantJoinedNotification(ParticipantIdWithPermissions, ConferenceId));
            NotificationCollector.Reset();

            // act
            await Mediator.Send(new UpdateSubscriptionsRequest(ConferenceId, ParticipantIdWithPermissions));

            // assert
            NotificationCollector.AssertNoMoreNotifications();
        }

        [Fact]
        public async Task UpdateSubscriptions_SubscriptionAdded_SendCurrentSyncObjState()
        {
            const string randomParticipant = "c3a993ffed6f4c229fdfdf755cb2564e";

            // arrange
            SetHasNoPermissionsForParticipant(randomParticipant);

            await Mediator.Publish(new ParticipantJoinedNotification(randomParticipant, ConferenceId));

            SetHasPermissionsForParticipant(randomParticipant);
            NotificationCollector.Reset();

            // act
            await Mediator.Send(new UpdateSubscriptionsRequest(ConferenceId, randomParticipant));

            // assert
            NotificationCollector.AssertSingleNotificationIssued<SynchronizedObjectUpdatedNotification>();
        }

        [Fact]
        public async Task UpdateSubscriptions_SubscriptionRemoved_DontSendUpdatesAnymore()
        {
            const string randomParticipant = "562ce878f2284eb59fdd13a484736085";

            // arrange
            SetHasPermissionsForParticipant(randomParticipant);

            await Mediator.Publish(new ParticipantJoinedNotification(randomParticipant, ConferenceId));

            SetHasNoPermissionsForParticipant(randomParticipant);
            NotificationCollector.Reset();

            SyncObjValue = "newVal";

            // act
            await Mediator.Send(new UpdateSubscriptionsRequest(ConferenceId, randomParticipant));
            await Mediator.Send(
                new UpdateSynchronizedObjectRequest(ConferenceId, SynchronizedObjectId.Parse(SyncObjId)));

            // assert
            NotificationCollector.AssertSingleNotificationIssued<ParticipantSubscriptionsRemovedNotification>();
            NotificationCollector.AssertNoMoreNotifications();
        }
    }
}