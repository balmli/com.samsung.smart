function createApplicationTests(session, app) {
    return [
        {
            id: 'launch-app',
            title: `Launch ${app?.name || 'the selected application'}`,
            disruptive: true,
            run: async context => {
                if (!app) context.skip('No installed application was selected');
                await session.operations.launchApp(app);
                await context.verify(`Did ${app.name} open?`);
            },
        },
        {
            id: 'app-running',
            title: `Check whether ${app?.name || 'the selected application'} is running`,
            run: async context => {
                if (!app) context.skip('No installed application was selected');
                if (!(await session.operations.isAppRunning(app))) {
                    throw new Error(`The TV did not report ${app.name} as running`);
                }
            },
        },
        {
            id: 'close-app',
            title: `Close ${app?.name || 'the selected application'}`,
            disruptive: true,
            run: async context => {
                if (!app) context.skip('No installed application was selected');
                await session.operations.closeApp(app);
                await context.verify(`Did ${app.name} close?`);
            },
        },
    ];
}

module.exports = {createApplicationTests};
